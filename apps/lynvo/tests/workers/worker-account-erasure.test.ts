import { describe, expect, it } from "vitest"
import { csrfCookie } from "../../app/lib/csrf"
import { createFakeD1Database } from "../support/fake-d1"

describe("Account erasure HTTP behavior", () => {
  it("expires the session cookie in the successful deletion response", async () => {
    let didCloseRealtimeAccount = false
    const csrfCookieHeader = await csrfCookie.serialize("test-csrf-token")
    const database = createFakeD1Database((sql) => {
      if (sql.includes("INNER JOIN users u")) {
        return {
          row: {
            session_id: "session-1",
            user_id: "user-1",
            email: "user@example.com",
            last_seen_at: Date.now(),
            expires_at: Date.now() + 60_000,
          },
        }
      }
      if (sql.includes("google_subject, email, display_name")) {
        return {
          row: {
            id: "user-1",
            google_subject: "google-subject",
            email: "user@example.com",
            display_name: null,
            avatar_url: null,
            data_version: 1,
            erasure_pending_at: null,
            storage_retention_days: 30,
            range_supported_player_id: null,
            range_unsupported_player_id: null,
            created_at: Date.now(),
          },
        }
      }
      return undefined
    })
    const { default: worker } = await import("../../workers/app")
    // SAFETY: Account erasure uses only the bindings supplied by this focused Worker test.
    const environment = {
      ENVIRONMENT: "production",
      DB: database,
      USER_REALTIME_ROOM: {
        getByName: () => ({
          fetch: async (_url: string, init?: RequestInit) => {
            if (init?.method === "POST") {
              didCloseRealtimeAccount = true
            }
            return Response.json({ success: true })
          },
        }),
      },
    } as Env
    // SAFETY: The Worker only calls waitUntil on this execution context.
    const executionContext = { waitUntil: () => undefined } as ExecutionContext
    const response = await worker.fetch(
      new Request(
        "https://lynvo.dg02002.workers.dev/api/settings/security/account",
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            Cookie: `lynvo_session=opaque-session-id; ${csrfCookieHeader}`,
            Origin: "https://lynvo.dg02002.workers.dev",
            "X-CSRF-Token": "test-csrf-token",
            "X-Lynvo-Expected-User-Id": "user-1",
            "X-Lynvo-Expected-Session-Id": "session-1",
          },
          body: JSON.stringify({ confirmEmail: "user@example.com" }),
        }
      ),
      environment,
      executionContext
    )

    expect(response.status).toBe(200)
    expect(didCloseRealtimeAccount).toBe(true)
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0")
    await expect(response.json()).resolves.toEqual({ success: true })
  })
})
