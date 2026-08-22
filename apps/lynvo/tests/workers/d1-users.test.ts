import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"
import {
  getOrCreateGoogleUser,
  insertGoogleUser,
} from "../../workers/d1/users"

const NOW = 1_750_000_000_000

describe("d1 users", () => {
  it("creates a user from a Google profile", async () => {
    const googleSubject = `subject-${crypto.randomUUID()}`
    const { user, didCreate } = await getOrCreateGoogleUser(env.DB, {
      googleSubject,
      email: "new-user@example.com",
      displayName: "New User",
      avatarUrl: "https://example.com/avatar.png",
      now: NOW,
    })
    expect(didCreate).toBe(true)
    expect(user.googleSubject).toBe(googleSubject)
    expect(user.email).toBe("new-user@example.com")
    expect(user.displayName).toBe("New User")
    expect(user.dataVersion).toBe(1)
    expect(user.erasurePendingAt).toBeNull()
  })

  it("returns the existing user for a repeated Google subject", async () => {
    const googleSubject = `subject-${crypto.randomUUID()}`
    const inserted = await insertGoogleUser(env.DB, {
      googleSubject,
      email: "existing@example.com",
      now: NOW,
    })
    const { user, didCreate } = await getOrCreateGoogleUser(env.DB, {
      googleSubject,
      email: "existing@example.com",
      now: NOW + 1_000,
    })
    expect(didCreate).toBe(false)
    expect(user.id).toBe(inserted.id)
    expect(user.createdAt).toBe(NOW)
  })
})
