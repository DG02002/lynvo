import { describe, expect, it, vi } from "vitest"
import { csrfCookie } from "../../app/lib/csrf"
import { loadRemoteSessions } from "~/components/remote-play/use-remote-sessions"
import { createFakeD1Database } from "../support/fake-d1"

describe("Remote Play Worker contract", () => {
  it("maps the typed settings session contract to target devices", async () => {
    const listSessions = vi.fn(async () => [
      {
        id: "current-session",
        receiverId: "current-receiver",
        deviceName: "This device",
        lastActiveAt: 100,
        createdAt: 50,
        isCurrent: true,
      },
      {
        id: "target-session",
        receiverId: "target-receiver",
        deviceName: "Living room TV",
        lastActiveAt: 90,
        createdAt: 40,
        isCurrent: false,
      },
    ])

    await expect(loadRemoteSessions(listSessions)).resolves.toEqual([
      {
        id: "target-session",
        deviceName: "Living room TV",
        lastActiveAt: 90,
      },
    ])
    expect(listSessions).toHaveBeenCalledOnce()
  })

  it.each([
    ["POST", "/api/remote/send"],
    ["GET", "/api/remote/inbox"],
    ["POST", "/api/remote/result"],
  ])("refuses unauthenticated %s %s", async (method, path) => {
    const { default: worker } = await import("../../workers/app")
    // SAFETY: Route registration only reads ENVIRONMENT in this smoke test.
    const environment = { ENVIRONMENT: "development" } as Env
    // SAFETY: The Worker only calls waitUntil on this execution context.
    const executionContext = { waitUntil: () => undefined } as ExecutionContext
    const response = await worker.fetch(
      new Request(`https://lynvo.test${path}`, {
        method,
        headers: { Origin: "https://lynvo.test" },
      }),
      environment,
      executionContext
    )

    // Without a session, CSRF, database, or auth must refuse the request —
    // whichever guard fires first depends on the environment, but the route
    // can never succeed (2xx) or be missing (404).
    expect(response.ok).toBe(false)
    expect(response.status).not.toBe(404)
  })

  it("returns a validation error for an invalid remote receiver target", async () => {
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
      return undefined
    })
    const csrfCookieHeader = await csrfCookie.serialize("test-csrf-token")
    const { default: worker } = await import("../../workers/app")
    // SAFETY: This route test supplies only the bindings used by remote send.
    const environment = {
      ENVIRONMENT: "development",
      DB: database,
    } as Env
    // SAFETY: The Worker only calls waitUntil on this execution context.
    const executionContext = { waitUntil: () => undefined } as ExecutionContext
    const response = await worker.fetch(
      new Request("https://lynvo.test/api/remote/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `lynvo_session=opaque-session-id; ${csrfCookieHeader}`,
          Origin: "https://lynvo.test",
          "X-CSRF-Token": "test-csrf-token",
          "X-Lynvo-Expected-User-Id": "user-1",
          "X-Lynvo-Expected-Session-Id": "session-1",
        },
        body: JSON.stringify({
          target_session_id: "not-a-remote-target",
          command: "play",
        }),
      }),
      environment,
      executionContext
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      _tag: "ValidationError",
      message: "Remote receiver target is invalid",
    })
  })
})
