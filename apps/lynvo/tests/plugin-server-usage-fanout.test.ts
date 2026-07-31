// @vitest-environment edge-runtime

import { vi } from "vitest"
import { csrfCookie } from "../app/lib/csrf"

const PLUGIN_SERVER_COUNT = 6
let queryCount = 0

const manifest = JSON.stringify({
  protocolVersion: "1.0",
  pluginServerId: "dev.example.plugin-server",
  displayName: "Example",
  auth: { type: "bearer" },
  usage: { endpoint: "/usage" },
  matchers: [{ hosts: ["source.example"] }],
  features: {},
  extensions: {},
})

const storedPluginServers = Array.from(
  { length: PLUGIN_SERVER_COUNT },
  (_, index) => ({
    _id: `plugin-server-${index}`,
    _creationTime: index,
    userId: "users:123",
    baseUrl: `https://plugin-server-${index}.example`,
    manifest,
    enabled: true,
    priority: 0,
    verificationStatus: "verified",
    createdAt: index,
    updatedAt: index,
    apiKeyCiphertext: `ciphertext-${index}`,
    apiKeyNonce: `nonce-${index}`,
    apiKeyAlgorithm: "AES-256-GCM",
    apiKeyVersion: 1,
  })
)

vi.mock("virtual:react-router/server-build", () => ({}))
vi.mock("cloudflare:workers", () => ({ DurableObject: class {} }))
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    setAuth = () => undefined
    query = async () => {
      queryCount += 1
      return queryCount === 1
        ? {
            id: "users:123",
            username: "darshan",
            sessionId: "authSessions:456",
          }
        : storedPluginServers
    }
    mutation = async () => ({ success: true })
  },
}))

describe("Plugin Server usage HTTP fan-out", () => {
  it("bounds concurrent Custom Plugin Server usage requests", async () => {
    queryCount = 0
    let activeRequests = 0
    let maximumActiveRequests = 0
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => {
        activeRequests += 1
        maximumActiveRequests = Math.max(maximumActiveRequests, activeRequests)
        await new Promise((resolve) => setTimeout(resolve, 10))
        activeRequests -= 1
        return Response.json({
          metrics: [
            {
              id: "operations",
              label: "Operations",
              used: 1,
              limit: 100,
              unit: "requests",
              period: "daily",
              resetsAt: "2030-01-01T00:00:00.000Z",
            },
          ],
        })
      })
    const { default: worker } = await import("../workers/app")
    const response = await worker.fetch(
      new Request(
        "https://lynvo.dg02002.workers.dev/api/plugin-servers/usage",
        {
          headers: { Cookie: "__Host-lynvo-session=opaque-session-id" },
        }
      ),
      {
        ENVIRONMENT: "production",
        VITE_CONVEX_URL: "https://convex.example",
        AUTH_GATEWAY_SECRET: "test-gateway-secret",
        WORKER_AUTH_SESSION: {
          getByName: () => ({
            fetch: async () =>
              Response.json({
                accessToken: "access-token",
                refreshToken: "refresh-token",
                createdAt: 1,
                expiresAt: Date.now() + 60_000,
              }),
          }),
        },
        PLUGIN_SERVER_CREDENTIAL_VAULT: {
          getByName: () => ({
            fetch: async () =>
              Response.json({ apiKey: "plugin-server-api-key" }),
          }),
        },
      } as Env,
      { waitUntil: () => undefined } as ExecutionContext
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toHaveLength(PLUGIN_SERVER_COUNT)
    expect(maximumActiveRequests).toBeLessThanOrEqual(3)
    fetchMock.mockRestore()
  })

  it("rejects registration before contacting another Plugin Server at the account limit", async () => {
    queryCount = 0
    const csrfCookieHeader = await csrfCookie.serialize("test-csrf-token")
    const fetchMock = vi.spyOn(globalThis, "fetch")
    const { default: worker } = await import("../workers/app")
    const response = await worker.fetch(
      new Request("https://lynvo.dg02002.workers.dev/api/plugin-servers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: `__Host-lynvo-session=opaque-session-id; ${csrfCookieHeader}`,
          Origin: "https://lynvo.dg02002.workers.dev",
          "X-CSRF-Token": "test-csrf-token",
        },
        body: JSON.stringify({
          baseUrl: "https://new-plugin-server.example",
          apiKey: "new-plugin-server-key",
        }),
      }),
      {
        ENVIRONMENT: "production",
        VITE_CONVEX_URL: "https://convex.example",
        AUTH_GATEWAY_SECRET: "test-gateway-secret",
        WORKER_AUTH_SESSION: {
          getByName: () => ({
            fetch: async () =>
              Response.json({
                accessToken: "access-token",
                refreshToken: "refresh-token",
                createdAt: 1,
                expiresAt: Date.now() + 60_000,
              }),
          }),
        },
        PLUGIN_SERVER_CREDENTIAL_VAULT: {
          getByName: () => ({
            fetch: async () =>
              Response.json({ apiKey: "plugin-server-api-key" }),
          }),
        },
      } as Env,
      { waitUntil: () => undefined } as ExecutionContext
    )

    expect(response.status).toBe(422)
    expect(fetchMock).not.toHaveBeenCalled()
    expect(await response.text()).toContain("saved plugin server limit")
    fetchMock.mockRestore()
  })
})
