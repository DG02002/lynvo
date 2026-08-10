import { describe, expect, it } from "vitest"
import { buildPlayerPreferencesPatch } from "../convex/userPreferences"

describe("account lifecycle", () => {
  it("validates player preferences as one policy", () => {
    expect(
      buildPlayerPreferencesPatch({
        rangeSupportedPlayerId: "vlc",
        rangeUnsupportedPlayerId: "mx",
      })
    ).toEqual({
      rangeSupportedPlayerId: "vlc",
      rangeUnsupportedPlayerId: "mx",
    })
    expect(() =>
      buildPlayerPreferencesPatch({ rangeSupportedPlayerId: "unknown" })
    ).toThrow("Choose Just (Video) Player, VLC for Android, MPV, or MX Player")
  })
})
