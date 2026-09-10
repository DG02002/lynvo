import { afterEach, describe, expect, it, vi } from "vitest"
import { csrfCookie } from "../../app/lib/csrf"
import { createFakeD1Database } from "../support/fake-d1"

const pluginServerManifest = JSON.stringify({
  protocolVersion: "1.0",
  pluginServerId: "dev.example.plugin-server",
  displayName: "Proxy Capable",
  auth: { type: "bearer" },
  usage: { endpoint: "/usage" },
  matchers: [{ hosts: ["source.example"] }],
  features: {},
  extensions: {
    lynvo: {
      proxyProvider: "scrape-do",
      plugins: [
        {
          id: "source-alpha",
          displayName: "Source Alpha",
          status: "active",
          version: "1.0.0",
          hosts: ["source.example"],
        },
      ],
    },
  },
})

const pluginServerRow = {
  id: "plugin-server-1",
  user_id: "user-1",
  base_url: "https://plugins.example.com",
  normalized_base_url: "https://plugins.example.com",
  api_key_ciphertext: "api-ciphertext",
  api_key_nonce: "api-nonce",
  api_key_algorithm: "AES-256-GCM",
  api_key_version: 1,
  proxy_token_ciphertext: "proxy-ciphertext",
  proxy_token_nonce: "proxy-nonce",
  proxy_token_algorithm: "AES-256-GCM",
  proxy_token_version: 1,
  proxy_balance_remaining: 973,
  proxy_balance_limit: 1_000,
  proxy_balance_checked_at: 1,
  proxy_enabled: 0,
  credential_status: "ready",
  credential_generation: 1,
  credential_attempt_id: null,
  pending_expires_at: null,
  failure_reason: null,
  manifest: pluginServerManifest,
  enabled: 1,
  priority: 0,
  verification_status: "verified",
  last_verified_at: 1,
  last_manifest_refresh_at: 1,
  created_at: 1,
  updated_at: 1,
}

const enabledPluginServerRow = { ...pluginServerRow, proxy_enabled: 1 }

const createDatabase = (row: typeof pluginServerRow) =>
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
      return { row, rows: [row] }
    }
    return undefined
  })

const database = createDatabase(pluginServerRow)
const enabledDatabase = createDatabase(enabledPluginServerRow)

describe("public Extraction proxy behavior", () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
  })

  it("omits proxy from the public extract request when the server toggle is off", async () => {
    const { default: app } = await import("../../workers/app")
    const pluginServerFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        plugin: {
          pluginServerId: "dev.example.plugin-server",
          displayName: "Proxy Capable",
          pluginId: "source-alpha",
          pluginName: "Source Alpha",
        },
        nodes: [],
        extensions: {},
      })
    )
    // SAFETY: This route test supplies only the bindings used by public extraction.
    const environment = {
      ENVIRONMENT: "development",
      DB: database,
      PLUGIN_SERVER_CREDENTIAL_VAULT: {
        getByName: () => ({
          fetch: async () => Response.json({ apiKey: "stored-credential" }),
        }),
      },
    } as Env
    // SAFETY: The Worker only calls waitUntil while recording request logs.
    const executionContext = { waitUntil: () => undefined } as ExecutionContext
    const requestUrl = new URL("https://lynvo.test/api/extract")
    requestUrl.searchParams.set("url", "https://source.example/title")
    requestUrl.searchParams.set("pluginServerId", "plugin-server-1")
    requestUrl.searchParams.set("pluginId", "source-alpha")

    const response = await app.fetch(
      new Request(requestUrl, {
        headers: {
          Cookie: "lynvo_session=session-1",
          "X-Lynvo-Expected-User-Id": "user-1",
          "X-Lynvo-Expected-Session-Id": "session-1",
        },
      }),
      environment,
      executionContext
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ links: [] })
    expect(pluginServerFetch).toHaveBeenCalledOnce()
    const request = pluginServerFetch.mock.calls[0]?.[0]
    if (!(request instanceof Request)) {
      throw new Error("Expected the custom Plugin Server request")
    }
    expect(await request.json()).not.toHaveProperty("proxy")
  })

  it("forwards the enabled proxy key through the public extract route", async () => {
    const { default: app } = await import("../../workers/app")
    const pluginServerFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json({
        plugin: {
          pluginServerId: "dev.example.plugin-server",
          displayName: "Proxy Capable",
          pluginId: "source-alpha",
          pluginName: "Source Alpha",
        },
        nodes: [],
        extensions: {},
      })
    )
    // SAFETY: This route test supplies only the bindings used by public extraction.
    const environment = {
      ENVIRONMENT: "development",
      DB: enabledDatabase,
      PLUGIN_SERVER_CREDENTIAL_VAULT: {
        getByName: () => ({
          fetch: async () => Response.json({ apiKey: "stored-credential" }),
        }),
      },
    } as Env
    // SAFETY: The Worker only calls waitUntil while recording request logs.
    const executionContext = { waitUntil: () => undefined } as ExecutionContext
    const requestUrl = new URL("https://lynvo.test/api/extract")
    requestUrl.searchParams.set("url", "https://source.example/title")
    requestUrl.searchParams.set("pluginServerId", "plugin-server-1")
    requestUrl.searchParams.set("pluginId", "source-alpha")

    const response = await app.fetch(
      new Request(requestUrl, {
        headers: {
          Cookie: "lynvo_session=session-1",
          "X-Lynvo-Expected-User-Id": "user-1",
          "X-Lynvo-Expected-Session-Id": "session-1",
        },
      }),
      environment,
      executionContext
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ links: [] })
    expect(pluginServerFetch).toHaveBeenCalledOnce()
    const request = pluginServerFetch.mock.calls[0]?.[0]
    if (!(request instanceof Request)) {
      throw new Error("Expected the custom Plugin Server request")
    }
    expect(await request.json()).toMatchObject({
      proxy: {
        provider: "scrape-do",
        token: "stored-credential",
      },
    })
  })

  it("returns the proxy toggle data version in the body and response header", async () => {
    const { default: app } = await import("../../workers/app")
    const csrfCookieHeader = await csrfCookie.serialize("test-csrf-token")
    // SAFETY: This route test supplies only the bindings used by the API handler.
    const environment = {
      ENVIRONMENT: "development",
      DB: database,
      PLUGIN_SERVER_CREDENTIAL_VAULT: {
        getByName: () => ({
          fetch: async () => Response.json({ apiKey: "stored-credential" }),
        }),
      },
    } as Env
    // SAFETY: The Worker only calls waitUntil while recording request logs.
    const executionContext = { waitUntil: () => undefined } as ExecutionContext
    const response = await app.fetch(
      new Request(
        "https://lynvo.test/api/plugin-servers/plugin-server-1/proxy-toggle",
        {
          method: "POST",
          headers: {
            Cookie: `lynvo_session=session-1; ${csrfCookieHeader}`,
            Origin: "https://lynvo.test",
            "X-CSRF-Token": "test-csrf-token",
            "X-Lynvo-Expected-User-Id": "user-1",
            "X-Lynvo-Expected-Session-Id": "session-1",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ enabled: true }),
        }
      ),
      environment,
      executionContext
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("X-Lynvo-Data-Version")).toBe("2")
    await expect(response.json()).resolves.toEqual({
      success: true,
      dataVersion: 2,
    })
  })
})
