import { describe, expect, it, vi } from "vitest"
import { loadRemoteSessions } from "~/components/remote-play/use-remote-sessions"
import {
  buildAuthenticatedWorkerRequest,
  createAuthenticatedWorkerDatabase,
  createWorkerEnvironment,
  createWorkerExecutionContext,
} from "../support/worker-route"

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
    const database = createAuthenticatedWorkerDatabase()
    const { default: worker } = await import("../../workers/app")
    const environment = createWorkerEnvironment({
      database,
      environment: "development",
    })
    const response = await worker.fetch(
      await buildAuthenticatedWorkerRequest("/api/remote/send", {
        method: "POST",
        body: {
          target_session_id: "not-a-remote-target",
          command: "play",
        },
      }),
      environment,
      createWorkerExecutionContext()
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      _tag: "ValidationError",
      message: "Remote receiver target is invalid",
    })
  })

  it("returns a validation error when the remote receiver is offline", async () => {
    const database = createAuthenticatedWorkerDatabase()
    const { default: worker } = await import("../../workers/app")
    const environment = createWorkerEnvironment({
      database,
      environment: "development",
      userRealtimeRoom: {
        getByName: () => ({
          fetch: async () => Response.json({ receivers: [] }),
        }),
      },
    })
    const response = await worker.fetch(
      await buildAuthenticatedWorkerRequest("/api/remote/send", {
        method: "POST",
        body: {
          target_session_id: "target-session:target-receiver",
          command: "play",
        },
      }),
      environment,
      createWorkerExecutionContext()
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      _tag: "ValidationError",
      message: "Remote receiver is offline",
    })
  })
})
