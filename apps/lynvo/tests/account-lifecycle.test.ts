import { describe, expect, it } from "vitest"
import { normalizePlayerId } from "../workers/d1/users"

describe("account lifecycle", () => {
  it("validates player preferences as one policy", () => {
    expect(normalizePlayerId("vlc")).toBe("vlc")
    expect(normalizePlayerId("mx")).toBe("mx")
    expect(() => normalizePlayerId("unknown")).toThrow(
      "Choose Just (Video) Player, VLC for Android, MPV, or MX Player"
    )
  })
})
