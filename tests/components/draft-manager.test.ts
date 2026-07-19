import { describe, expect, it, beforeEach } from "vitest"
import {
  writeDraft,
  readDraft,
  deleteDraft,
} from "~/components/links/DraftManager"
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

describe("DraftManager", () => {
  beforeEach(() => {
    const mockStorage = createMockStorage()
    Object.defineProperty(globalThis, "localStorage", {
      value: mockStorage,
      configurable: true,
    })
    mockStorage.clear()
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
})
