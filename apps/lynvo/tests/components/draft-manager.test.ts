import { describe, expect, it, beforeEach, afterEach, vi } from "vitest"
import {
  writeDraft,
  readDraft,
  deleteDraft,
  getDraftsSnapshot,
  subscribeToDrafts,
} from "~/features/links/drafts"
import type { ExtractedLink, MetaData } from "~/features/links/types"

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
      { url: "https://example.com/file.mp4", label: "File", id: "file-1" },
    ]
    const meta: MetaData = {
      pluginName: "Spencerwooo's Onedrive Vercel Index",
    }

    writeDraft("https://example.com", links, meta)
    const draft = readDraft("https://example.com")

    expect(draft).toBeDefined()
    expect(draft).not.toHaveProperty("selectedIds")
    expect(draft?.links).toEqual(links)
    expect(draft?.meta.pluginName).toBe("Spencerwooo's Onedrive Vercel Index")
  })

  it("removes a draft", () => {
    writeDraft(
      "https://example.com",
      [{ url: "https://example.com/file.mp4", label: "File" }],
      {}
    )
    deleteDraft("https://example.com")

    expect(readDraft("https://example.com")).toBeNull()
  })

  it("removes malformed draft storage instead of trusting parsed JSON", () => {
    localStorage.setItem(
      "lynvo:drafts:v1",
      JSON.stringify({
        corrupted: {
          links: "not-an-array",
          meta: {},
          originalUrl: "https://example.com",
          expiresAt: Date.now() + 60_000,
        },
      })
    )

    expect(readDraft("https://example.com")).toBeNull()
    expect(localStorage.getItem("lynvo:drafts:v1")).toBeNull()
  })

  it("arms expiry when a draft is written after subscription", () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    const subscriber = vi.fn()
    const unsubscribe = subscribeToDrafts(subscriber)

    writeDraft("https://example.com/late", [], {})
    subscriber.mockClear()
    vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1_000)

    expect(subscriber).toHaveBeenCalledOnce()
    expect(getDraftsSnapshot()).toEqual([])
    unsubscribe()
  })

  it("re-arms for sequential expirations and deletion of the nearest draft", () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    writeDraft("https://example.com/first", [], {})
    vi.advanceTimersByTime(1_000)
    writeDraft("https://example.com/second", [], {})
    const subscriber = vi.fn()
    const unsubscribe = subscribeToDrafts(subscriber)

    deleteDraft("https://example.com/first")
    subscriber.mockClear()
    vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1_000 - 1)
    expect(subscriber).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)

    expect(subscriber).toHaveBeenCalledOnce()
    expect(getDraftsSnapshot()).toEqual([])
    unsubscribe()
  })

  it("publishes each sequential draft expiration", () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    writeDraft("https://example.com/first-sequential", [], {})
    vi.advanceTimersByTime(1_000)
    writeDraft("https://example.com/second-sequential", [], {})
    const subscriber = vi.fn()
    const unsubscribe = subscribeToDrafts(subscriber)

    vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1_000 - 1_000)
    expect(subscriber).toHaveBeenCalledTimes(1)
    expect(getDraftsSnapshot()).toHaveLength(1)

    vi.advanceTimersByTime(1_000)
    expect(subscriber).toHaveBeenCalledTimes(2)
    expect(getDraftsSnapshot()).toEqual([])
    unsubscribe()
  })
})
