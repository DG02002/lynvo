import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"
import {
  writeDraft,
  readDraft,
  deleteDraft,
  getDraftsSnapshot,
  subscribeToDrafts,
} from "~/features/links/drafts"
import type { ExtractedLink, MetaData } from "~/features/links/types"

const TEST_USER_ID = "test-user"

const createMockStorage = () => {
  let store: Record<string, string> = {}
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
}

describe("Draft module", () => {
  beforeEach(() => {
    const mockStorage = createMockStorage()
    Object.defineProperty(globalThis, "localStorage", {
      value: mockStorage,
      configurable: true,
    })
    mockStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("stores the current tree without selection state", () => {
    const links: ExtractedLink[] = [
      {
        nodeKey: "test:file-1",
        url: "https://example.com/file.mp4",
        label: "File",
        id: "file-1",
        type: "file",
        mediaNodeKind: "playable",
      },
    ]
    const meta: MetaData = {
      pluginName: "Spencerwooo's Onedrive Vercel Index",
    }

    writeDraft(TEST_USER_ID, "https://example.com", links, meta)
    const draft = readDraft(TEST_USER_ID, "https://example.com")

    expect(draft).toBeDefined()
    expect(draft).not.toHaveProperty("selectedIds")
    expect(draft?.links).toEqual(links)
    expect(draft?.meta.pluginName).toBe("Spencerwooo's Onedrive Vercel Index")
  })

  it("removes a draft", () => {
    writeDraft(
      TEST_USER_ID,
      "https://example.com",
      [
        {
          nodeKey: "test:file",
          url: "https://example.com/file.mp4",
          label: "File",
          type: "file",
          mediaNodeKind: "playable",
        },
      ],
      {}
    )
    deleteDraft(TEST_USER_ID, "https://example.com")

    expect(readDraft(TEST_USER_ID, "https://example.com")).toBeNull()
  })

  it("isolates drafts by account identity", () => {
    writeDraft("account-a", "https://private.example", [], {})

    expect(readDraft("account-b", "https://private.example")).toBeNull()
    expect(getDraftsSnapshot("account-b")).toEqual([])
    expect(readDraft("account-a", "https://private.example")).not.toBeNull()
  })

  it("removes malformed draft storage instead of trusting parsed JSON", () => {
    localStorage.setItem(
      `lynvo:drafts:v2:${TEST_USER_ID}`,
      JSON.stringify({
        corrupted: {
          links: "not-an-array",
          meta: {},
          originalUrl: "https://example.com",
          expiresAt: Date.now() + 60_000,
        },
      })
    )

    expect(readDraft(TEST_USER_ID, "https://example.com")).toBeNull()
    expect(localStorage.getItem(`lynvo:drafts:v2:${TEST_USER_ID}`)).toBeNull()
  })

  it("arms expiry when a draft is written after subscription", () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    const subscriber = vi.fn()
    const unsubscribe = subscribeToDrafts(TEST_USER_ID, subscriber)

    writeDraft(TEST_USER_ID, "https://example.com/late", [], {})
    subscriber.mockClear()
    vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1_000)

    expect(subscriber).toHaveBeenCalledOnce()
    expect(getDraftsSnapshot(TEST_USER_ID)).toEqual([])
    unsubscribe()
  })

  it("re-arms for sequential expirations and deletion of the nearest draft", () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    writeDraft(TEST_USER_ID, "https://example.com/first", [], {})
    vi.advanceTimersByTime(1_000)
    writeDraft(TEST_USER_ID, "https://example.com/second", [], {})
    const subscriber = vi.fn()
    const unsubscribe = subscribeToDrafts(TEST_USER_ID, subscriber)

    deleteDraft(TEST_USER_ID, "https://example.com/first")
    subscriber.mockClear()
    vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1_000 - 1)
    expect(subscriber).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)

    expect(subscriber).toHaveBeenCalledOnce()
    expect(getDraftsSnapshot(TEST_USER_ID)).toEqual([])
    unsubscribe()
  })

  it("publishes each sequential draft expiration", () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    writeDraft(TEST_USER_ID, "https://example.com/first-sequential", [], {})
    vi.advanceTimersByTime(1_000)
    writeDraft(TEST_USER_ID, "https://example.com/second-sequential", [], {})
    const subscriber = vi.fn()
    const unsubscribe = subscribeToDrafts(TEST_USER_ID, subscriber)

    vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1_000 - 1_000)
    expect(subscriber).toHaveBeenCalledTimes(1)
    expect(getDraftsSnapshot(TEST_USER_ID)).toHaveLength(1)

    vi.advanceTimersByTime(1_000)
    expect(subscriber).toHaveBeenCalledTimes(2)
    expect(getDraftsSnapshot(TEST_USER_ID)).toEqual([])
    unsubscribe()
  })
})
