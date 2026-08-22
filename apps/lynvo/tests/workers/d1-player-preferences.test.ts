import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"
import {
  getUserPlayerPreferences,
  insertGoogleUser,
  normalizePlayerId,
  updateUserPlayerPreferences,
} from "../../workers/d1/users"
import { getStorageLedger } from "../../workers/d1/storage-ledger"

const NOW = 1_750_000_000_000

const createUser = async () =>
  insertGoogleUser(env.DB, {
    googleSubject: `subject-${crypto.randomUUID()}`,
    email: "player-prefs@example.com",
    now: NOW,
  })

describe("d1 player preferences", () => {
  it("returns empty preferences for a fresh account", async () => {
    const user = await createUser()

    await expect(
      getUserPlayerPreferences(env.DB, user.id)
    ).resolves.toEqual({})
  })

  it("stores and returns both player selections", async () => {
    const user = await createUser()

    await updateUserPlayerPreferences(env.DB, user.id, {
      rangeSupportedPlayerId: "vlc",
      rangeUnsupportedPlayerId: "mx",
      now: NOW,
    })

    await expect(getUserPlayerPreferences(env.DB, user.id)).resolves.toEqual({
      rangeSupportedPlayerId: "vlc",
      rangeUnsupportedPlayerId: "mx",
    })
  })

  it("patches one selection without clearing the other", async () => {
    const user = await createUser()
    await updateUserPlayerPreferences(env.DB, user.id, {
      rangeSupportedPlayerId: "just",
      rangeUnsupportedPlayerId: "mpv",
      now: NOW,
    })

    await updateUserPlayerPreferences(env.DB, user.id, {
      rangeSupportedPlayerId: "vlc",
      now: NOW + 1_000,
    })

    await expect(getUserPlayerPreferences(env.DB, user.id)).resolves.toEqual({
      rangeSupportedPlayerId: "vlc",
      rangeUnsupportedPlayerId: "mpv",
    })
  })

  it("rejects an unknown player id without writing", async () => {
    const user = await createUser()

    await expect(
      updateUserPlayerPreferences(env.DB, user.id, {
        rangeSupportedPlayerId: "youtube",
        now: NOW,
      })
    ).rejects.toThrow(
      "Choose Just (Video) Player, VLC for Android, MPV, or MX Player"
    )
    await expect(
      getUserPlayerPreferences(env.DB, user.id)
    ).resolves.toEqual({})
  })

  it("keeps the data version stable when nothing changes", async () => {
    const user = await createUser()
    const first = await updateUserPlayerPreferences(env.DB, user.id, {
      rangeSupportedPlayerId: "vlc",
      now: NOW,
    })
    const unchanged = await updateUserPlayerPreferences(env.DB, user.id, {
      rangeSupportedPlayerId: "vlc",
      now: NOW + 1_000,
    })

    expect(first.dataVersion).toBeGreaterThan(1)
    expect(unchanged.dataVersion).toBe(first.dataVersion)
  })

  it("tracks profile bytes in the storage ledger", async () => {
    const user = await createUser()
    const beforeWrite = await getStorageLedger(env.DB, user.id)

    await updateUserPlayerPreferences(env.DB, user.id, {
      rangeSupportedPlayerId: "vlc",
      rangeUnsupportedPlayerId: "mx",
      now: NOW,
    })
    const afterWrite = await getStorageLedger(env.DB, user.id)

    expect(afterWrite?.profileBytes).toBeGreaterThan(
      beforeWrite?.profileBytes ?? 0
    )
  })

  it("normalizes only the supported player ids", () => {
    expect(normalizePlayerId("just")).toBe("just")
    expect(normalizePlayerId("vlc")).toBe("vlc")
    expect(normalizePlayerId("mpv")).toBe("mpv")
    expect(normalizePlayerId("mx")).toBe("mx")
  })
})
