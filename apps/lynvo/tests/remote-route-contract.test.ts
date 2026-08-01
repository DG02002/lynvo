// @vitest-environment edge-runtime

import { vi } from "vitest"

vi.mock("virtual:react-router/server-build", () => ({}))
vi.mock("cloudflare:workers", () => ({
  DurableObject: class {},
}))

describe("Remote Play Worker contract", () => {
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
