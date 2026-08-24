import { describe, expect, it, vi } from "vitest"
import { loadRemoteSessions } from "~/components/remote-play/use-remote-sessions"

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
  ])("registers %s %s", async (method, path) => {
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

    expect(response.status).not.toBe(404)
  })
})
