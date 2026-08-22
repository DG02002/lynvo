// @vitest-environment edge-runtime

import { vi } from "vitest"
import { createFakeD1Database } from "./support/fake-d1"

const PLUGIN_SERVER_COUNT = 6

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

const storedPluginServerRows = Array.from(
  { length: PLUGIN_SERVER_COUNT },
  (_, index) => ({
    id: `plugin-server-${index}`,
    user_id: "user-1",
    base_url: `https://plugin-server-${index}.example`,
    normalized_base_url: `https://plugin-server-${index}.example`,
    api_key_ciphertext: `ciphertext-${index}`,
    api_key_nonce: `nonce-${index}`,
    api_key_algorithm: "AES-256-GCM",
    api_key_version: 1,
    credential_status: "ready",
    credential_generation: 1,
    credential_attempt_id: null,
    pending_expires_at: null,
    failure_reason: null,
    manifest,
    enabled: 1,
    priority: 0,
    verification_status: "verified",
    last_verified_at: index,
    last_manifest_refresh_at: index,
    created_at: index,
    updated_at: index,
  })
)

vi.mock("virtual:react-router/server-build", () => ({}))
vi.mock("cloudflare:workers", () => ({ DurableObject: class {} }))

const createSessionAwareDatabase = () =>
  createFakeD1Database((sql) => {
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
    if (sql.includes("FROM user_plugin_servers")) {
      return { rows: storedPluginServerRows }
    }
    return undefined
  })

describe("Plugin Server usage HTTP fan-out", () => {
  it("bounds concurrent Custom Plugin Server usage requests", async () => {
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
          headers: {
            Cookie: "lynvo_session=opaque-session-id",
            "X-Lynvo-Expected-User-Id": "user-1",
            "X-Lynvo-Expected-Session-Id": "session-1",
          },
        }
      ),
      {
        ENVIRONMENT: "production",
        DB: createSessionAwareDatabase(),
        PLUGIN_SERVER_CREDENTIAL_VAULT: {
          getByName: () => ({
            fetch: async () =>
              Response.json({ apiKey: "plugin-server-api-key" }),
          }),
        },
      } as unknown as Env,
      { waitUntil: () => undefined } as ExecutionContext
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toHaveLength(PLUGIN_SERVER_COUNT)
    expect(maximumActiveRequests).toBeLessThanOrEqual(3)
    fetchMock.mockRestore()
  })
})
