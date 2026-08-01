// @vitest-environment edge-runtime

import { vi } from "vitest"
import { loadRemoteSessions } from "~/components/remote-play/use-remote-sessions"

vi.mock("virtual:react-router/server-build", () => ({}))
vi.mock("cloudflare:workers", () => ({
  DurableObject: class {},
}))

describe("Remote Play Worker contract", () => {
  it("maps the typed settings session contract to target devices", async () => {
    const listSessions = vi.fn(async () => [
      {
        id: "current-session",
        deviceName: "This device",
        lastActiveAt: 100,
        createdAt: 50,
        isCurrent: true,
      },
      {
        id: "target-session",
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
    ["POST", "/api/remote/acknowledge"],
  ])("registers %s %s", async (method, path) => {
    const { default: worker } = await import("../workers/app")
    const response = await worker.fetch(
      new Request(`https://lynvo.test${path}`, {
        method,
        headers: { Origin: "https://lynvo.test" },
      }),
      { ENVIRONMENT: "development" } as Env,
      { waitUntil: () => undefined } as ExecutionContext
    )

    expect(response.status).not.toBe(404)
  })
})
