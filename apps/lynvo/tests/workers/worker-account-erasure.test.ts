import { describe, expect, it } from "vitest"
import {
  buildAuthenticatedWorkerRequest,
  createAuthenticatedWorkerDatabase,
  createWorkerEnvironment,
  createWorkerExecutionContext,
} from "../support/worker-route"

describe("Account erasure HTTP behavior", () => {
  it("expires the session cookie in the successful deletion response", async () => {
    let didCloseRealtimeAccount = false
    const database = createAuthenticatedWorkerDatabase()
    const { default: worker } = await import("../../workers/app")
    const environment = createWorkerEnvironment({
      database,
      userRealtimeRoom: {
        getByName: () => ({
          fetch: async (_url: string, init?: RequestInit) => {
            if (init?.method === "POST") {
              didCloseRealtimeAccount = true
            }
            return Response.json({ success: true })
          },
        }),
      },
    })
    const response = await worker.fetch(
      await buildAuthenticatedWorkerRequest("/api/settings/security/account", {
        method: "DELETE",
        body: { confirmEmail: "user@example.com" },
      }),
      environment,
      createWorkerExecutionContext()
    )

    expect(response.status).toBe(200)
    expect(didCloseRealtimeAccount).toBe(true)
    expect(response.headers.get("Set-Cookie")).toContain("Max-Age=0")
    await expect(response.json()).resolves.toEqual({ success: true })
  })

  it("returns the email mismatch as a client error", async () => {
    const database = createAuthenticatedWorkerDatabase()
    const { default: worker } = await import("../../workers/app")
    const environment = createWorkerEnvironment({ database })
    const response = await worker.fetch(
      await buildAuthenticatedWorkerRequest("/api/settings/security/account", {
        method: "DELETE",
        body: { confirmEmail: "wrong@example.com" },
      }),
      environment,
      createWorkerExecutionContext()
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      _tag: "ValidationError",
      message: "Email does not match",
    })
  })
})
