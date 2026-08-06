import { describe, expect, it, vi } from "vitest"
import { replacePasswordAndInvalidateOtherSessions } from "../convex/accountLifecycle"
import { buildPlayerPreferencesPatch } from "../convex/userPreferences"

describe("account lifecycle", () => {
  it("replaces the password before invalidating other sessions", async () => {
    const transitions: string[] = []
    await replacePasswordAndInvalidateOtherSessions(
      async () => transitions.push("password-replaced"),
      async () => transitions.push("other-sessions-invalidated")
    )
    expect(transitions).toEqual([
      "password-replaced",
      "other-sessions-invalidated",
    ])
  })

  it("does not invalidate sessions when password replacement fails", async () => {
    const invalidate = vi.fn()
    await expect(
      replacePasswordAndInvalidateOtherSessions(async () => {
        throw new Error("incorrect password")
      }, invalidate)
    ).rejects.toThrow("incorrect password")
    expect(invalidate).not.toHaveBeenCalled()
  })

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
