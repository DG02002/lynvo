import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  PLAYER_DEFINITIONS,
  buildIntentUrl,
  selectPlayerForRangeCapability,
  setRangeSupportedPlayer,
  setRangeUnsupportedPlayer,
} from "~/lib/player-utils"

describe("player-utils", () => {
  const storage = new Map<string, string>()
  const localStorageMock = {
    clear: vi.fn(() => storage.clear()),
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
    removeItem: vi.fn((key: string) => storage.delete(key)),
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    storage.clear()
    localStorageMock.clear.mockImplementation(() => storage.clear())
    localStorageMock.getItem.mockImplementation(
      (key: string) => storage.get(key) ?? null
    )
    localStorageMock.setItem.mockImplementation((key: string, value: string) =>
      storage.set(key, value)
    )
    localStorageMock.removeItem.mockImplementation((key: string) =>
      storage.delete(key)
    )
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: localStorageMock,
    })
  })

  it("builds Android intent URLs for all four configured players", () => {
    for (const player of PLAYER_DEFINITIONS) {
      const intent = buildIntentUrl(
        "https://cdn.example.com/video.mp4?token=abc",
        player
      )

      expect(intent).toContain("intent://cdn.example.com/video.mp4?token=abc")
      expect(intent).toContain("scheme=https")
      expect(intent).toContain("action=android.intent.action.VIEW")
      expect(intent).toContain("type=video/*")
      expect(intent).toContain(`package=${player.packageName}`)
    }
  })

  it("uses Just (Video) Player for links with HTTP byte-range support by default", () => {
    expect(selectPlayerForRangeCapability("supported").id).toBe("just")
  })

  it("uses VLC for links without HTTP byte-range support by default", () => {
    expect(selectPlayerForRangeCapability("unsupported").id).toBe("vlc")
  })

  it("treats unknown byte-range support like supported requests", () => {
    expect(selectPlayerForRangeCapability("unknown").id).toBe("just")
  })

  it("uses saved player preferences", () => {
    setRangeSupportedPlayer("mpv")
    setRangeUnsupportedPlayer("mx")

    expect(selectPlayerForRangeCapability("supported").id).toBe("mpv")
    expect(selectPlayerForRangeCapability("unsupported").id).toBe("mx")
  })

  it("ignores invalid saved player preferences", () => {
    localStorageMock.getItem.mockReturnValue("missing-player")

    expect(selectPlayerForRangeCapability("supported").id).toBe("just")
    expect(selectPlayerForRangeCapability("unsupported").id).toBe("vlc")
  })
})
