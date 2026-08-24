import { describe, expect, it } from "vitest"
import { getCookieValue, normalizeReturnTo } from "../app/lib/auth-cookie"
import { D1_SESSION_COOKIE_NAME } from "../workers/constants"
import {
  responseWithSession,
  getUserSession,
  requireGuestOrRedirect,
} from "../app/lib/auth"
import { createFakeD1Database } from "./support/fake-d1"

const authenticatedDatabase = () =>
  createFakeD1Database((sql) => {
    if (sql.includes("INNER JOIN users u")) {
      return {
        row: {
          session_id: "session-123",
          user_id: "user-456",
          email: "darshan@example.com",
          display_name: "Darshan",
          last_seen_at: Date.now(),
          expires_at: Date.now() + 60_000,
        },
      }
    }
    return undefined
  })

describe("auth cookie helpers", () => {
  it("allows only application-relative return paths", () => {
    expect(normalizeReturnTo("/settings")).toBe("/settings")
    expect(normalizeReturnTo("https://attacker.test")).toBe("/")
    expect(normalizeReturnTo("//attacker.test")).toBe("/")
  })

  it("parses exact cookie names", () => {
    const request = new Request("https://lynvo.test", {
      headers: {
        Cookie: "other=1; exact-cookie=access%20token",
      },
    })
    expect(getCookieValue(request, "exact-cookie")).toBe("access token")
  })
})

describe("session-bearing responses", () => {
  it("prevents the browser from restoring stale session markup", () => {
    const response = responseWithSession(
      { user: null },
      { user: null },
      new Request("https://lynvo.test")
    )

    expect(new Headers(response.init?.headers).get("Cache-Control")).toBe(
      "no-store"
    )
  })

  it("refreshes an authenticated session cookie on document responses", () => {
    const sessionExpiresAt = Date.now() + 60_000
    const response = responseWithSession(
      {
        user: {
          sub: "user-456",
          email: "darshan@example.com",
          sid: "session-123",
        },
      },
      {
        user: {
          sub: "user-456",
          email: "darshan@example.com",
          sid: "session-123",
        },
        sessionExpiresAt,
      },
      new Request("https://lynvo.test/save", {
        headers: {
          Cookie: `${D1_SESSION_COOKIE_NAME}=opaque-session-id`,
        },
      }),
      { headers: { "Set-Cookie": "csrf-token=csrf-value" } }
    )

    const cookie = new Headers(response.init?.headers).get("Set-Cookie")
    expect(cookie).toContain("csrf-token=csrf-value")
    expect(cookie).toContain(`${D1_SESSION_COOKIE_NAME}=opaque-session-id`)
    const maxAgeSeconds = Number(cookie?.match(/Max-Age=(\d+)/)?.[1])
    expect(maxAgeSeconds).toBeGreaterThanOrEqual(59)
    expect(maxAgeSeconds).toBeLessThanOrEqual(60)
  })

  it("does not create a session cookie for anonymous document responses", () => {
    const response = responseWithSession(
      { user: null },
      { user: null },
      new Request("https://lynvo.test/save")
    )

    expect(new Headers(response.init?.headers).get("Set-Cookie")).toBeNull()
  })
})

describe("requireGuestOrRedirect", () => {
  const authenticatedSession = {
    user: {
      sub: "user-456",
      email: "darshan@example.com",
      sid: "session-123",
    },
  }
  const anonymousSession = { user: null }

  it("redirects an authenticated user to the ?redirect= destination", () => {
    expect(() =>
      requireGuestOrRedirect(
        authenticatedSession,
        new Request("https://lynvo.test/auth/log-in?redirect=%2Fsave")
      )
    ).toThrow()

    try {
      requireGuestOrRedirect(
        authenticatedSession,
        new Request("https://lynvo.test/auth/log-in?redirect=%2Fsave")
      )
    } catch (response: any) {
      expect(response.headers.get("Location")).toBe("/save")
    }
  })

  it("blocks an open-redirect attempt and falls back to /save", () => {
    try {
      requireGuestOrRedirect(
        authenticatedSession,
        new Request(
          "https://lynvo.test/auth/log-in?redirect=https%3A%2F%2Fattacker.test"
        )
      )
    } catch (response: any) {
      expect(response.headers.get("Location")).toBe("/save")
    }
  })

  it("does nothing for an unauthenticated user", () => {
    expect(() =>
      requireGuestOrRedirect(
        anonymousSession,
        new Request("https://lynvo.test/auth/log-in")
      )
    ).not.toThrow()
  })
})

describe("getUserSession", () => {
  it("returns an anonymous session without a cookie", async () => {
    // SAFETY: getUserSession only reads the DB binding from this test environment.
    const environment = {
      DB: createFakeD1Database(() => ({ rows: [] })),
    } as Env
    const result = await getUserSession(
      new Request("https://lynvo.test"),
      environment
    )
    expect(result).toEqual({ user: null, sessionExpiresAt: undefined })
  })

  it("resolves the D1 session identity without exposing tokens", async () => {
    // SAFETY: getUserSession only reads the DB binding from this test environment.
    const environment = { DB: authenticatedDatabase() } as Env
    const result = await getUserSession(
      new Request("https://lynvo.test", {
        headers: { Cookie: `${D1_SESSION_COOKIE_NAME}=opaque-session-id` },
      }),
      environment
    )
    expect(result.user).toEqual({
      sub: "user-456",
      email: "darshan@example.com",
      name: "Darshan",
      sid: "session-123",
    })
    expect(result.sessionExpiresAt).toBeGreaterThan(Date.now())
    expect(JSON.stringify(result)).not.toContain("refresh")
  })

  it("reports authentication as unavailable without a database binding", async () => {
    // SAFETY: The missing DB binding is the malformed environment under test.
    const environment = {} as Env
    await expect(
      getUserSession(new Request("https://lynvo.test"), environment)
    ).rejects.toMatchObject({ init: { status: 503 } })
  })
})
