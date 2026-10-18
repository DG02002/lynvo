import { validPluginServerManifestFixture } from "@dg02002/lynvo-plugin-server-protocol"
import { Schema } from "effect"
import { describe, expect, it } from "vitest"

import { DOCS_SEED_PLUGIN_SERVER_FIXTURES } from "../scripts/docs-seed-fixtures.mjs"
import { SeedApiClient, seedDocsSettings } from "../scripts/seed"
import { DOCS_SEED_PROXY_FIXTURES } from "../shared/docs-seed-constants"

interface MockPluginServer {
  readonly id: string
  readonly baseUrl: string
  readonly manifest: string
  enabled: boolean
  verificationStatus: string
  hasProxyKey: boolean
  proxyEnabled: boolean
  proxyBalanceRemaining: number | null
  proxyBalanceLimit: number | null
}

interface ApiCall {
  readonly method: string
  readonly path: string
  readonly body?: typeof DocsSettingsMutationBodySchema.Type
}

const DocsSettingsMutationBodySchema = Schema.Struct({
  baseUrl: Schema.optional(Schema.String),
  enabled: Schema.optional(Schema.Boolean),
  token: Schema.optional(Schema.String),
})

const parseApiBody = async (
  body: BodyInit | null | undefined
): Promise<typeof DocsSettingsMutationBodySchema.Type | undefined> => {
  if (body === null || body === undefined) {
    return undefined
  }
  const serializedBody = await new Response(body).text()
  return Schema.decodeUnknownSync(DocsSettingsMutationBodySchema)(
    JSON.parse(serializedBody)
  )
}

const createDocsSeedSettingsApi = () => {
  const servers: MockPluginServer[] = []
  const domains: { readonly id: string }[] = []
  const calls: ApiCall[] = []
  const manifest = JSON.stringify({
    ...validPluginServerManifestFixture,
    pluginServerId: "dev.lynvo.plugin-server",
    displayName: "Lynvo Plugin Server",
    extensions: {
      lynvo: {
        proxyProvider: "scrape-do",
        plugins: [
          {
            id: "bhadoo-google-drive-index",
            displayName: "Bhadoo’s Google Drive Index",
            status: "active",
            version: "1.0.0",
            hosts: ["drive.example.invalid"],
            proxyCreditUsage: "Demo estimate: 2 credits per Extraction.",
          },
          {
            id: "onedrive-index",
            displayName: "OneDrive Index",
            status: "active",
            version: "1.0.0",
            hosts: ["drive.example.invalid"],
            proxyCreditUsage: "Demo estimate: 2 credits per Extraction.",
          },
        ],
      },
    },
  })
  const usageMetric = {
    id: "lynvo-plugin-server-operations",
    label: "Plugin Server operations",
    used: 0,
    limit: 1_000,
    unit: "operations",
    period: "daily",
    resetsAt: "2026-10-19T00:00:00.000Z",
  }

  const api = new SeedApiClient(
    "http://localhost:5173",
    async (input, init) => {
      const target =
        input instanceof Request
          ? new URL(input.url)
          : new URL(input.toString())
      const method = (init?.method ?? "GET").toUpperCase()
      const body = await parseApiBody(init?.body)
      calls.push(
        body === undefined
          ? { method, path: target.pathname }
          : { method, path: target.pathname, body }
      )

      if (method === "GET" && target.pathname === "/api/plugin-domains") {
        return Response.json(domains)
      }
      if (method === "POST" && target.pathname === "/api/plugin-domains") {
        domains.push({ id: `domain-${domains.length + 1}` })
        return Response.json({})
      }
      if (
        method === "DELETE" &&
        target.pathname.startsWith("/api/plugin-domains/")
      ) {
        const domainId = decodeURIComponent(
          target.pathname.split("/").at(-1) ?? ""
        )
        const domainIndex = domains.findIndex(
          (domain) => domain.id === domainId
        )
        if (domainIndex !== -1) {
          domains.splice(domainIndex, 1)
        }
        return Response.json({})
      }
      if (method === "GET" && target.pathname === "/api/plugin-servers") {
        return Response.json(servers)
      }
      if (method === "POST" && target.pathname === "/api/plugin-servers") {
        const baseUrl = body?.baseUrl
        if (!baseUrl) {
          throw new Error("The docs seed did not send a Plugin Server URL.")
        }
        servers.push({
          id: new URL(baseUrl).port,
          baseUrl,
          manifest,
          enabled: true,
          verificationStatus: "verified",
          hasProxyKey: false,
          proxyEnabled: false,
          proxyBalanceRemaining: null,
          proxyBalanceLimit: null,
        })
        return Response.json({})
      }
      if (method === "GET" && target.pathname === "/api/plugin-servers/usage") {
        return Response.json(
          servers.map((server) => ({
            pluginServerId: server.id,
            name: "Lynvo Plugin Server",
            metrics: [usageMetric],
          }))
        )
      }
      if (method === "GET" && target.pathname === "/api/data/usage") {
        return Response.json({
          metrics: [
            { ...usageMetric, used: 1 },
            {
              ...usageMetric,
              id: "lynvo-plugin-server-extractions",
              used: 1,
            },
          ],
        })
      }
      if (
        method === "POST" &&
        target.pathname === "/api/data/usage/docs-seed"
      ) {
        return Response.json({})
      }

      const serverId = decodeURIComponent(target.pathname.split("/")[3] ?? "")
      const server = servers.find((entry) => entry.id === serverId)
      if (!server) {
        throw new Error(
          `Unexpected docs settings API request: ${method} ${target.pathname}`
        )
      }
      if (method === "POST" && target.pathname.endsWith("/refresh")) {
        server.verificationStatus = "verified"
        return Response.json({})
      }
      if (method === "POST" && target.pathname.endsWith("/proxy/toggle")) {
        server.proxyEnabled = body?.enabled === true
        return Response.json({})
      }
      if (method === "POST" && target.pathname.endsWith("/toggle")) {
        server.enabled = body?.enabled === true
        return Response.json({})
      }
      if (method === "POST" && target.pathname.endsWith("/proxy/key")) {
        const token = body?.token ?? ""
        if (token === "") {
          server.hasProxyKey = false
          server.proxyBalanceRemaining = null
          server.proxyBalanceLimit = null
        } else {
          const proxyFixture = Object.values(DOCS_SEED_PROXY_FIXTURES).find(
            (fixture) => fixture.key === token
          )
          if (!proxyFixture) {
            throw new Error("The docs seed sent an unknown proxy key.")
          }
          server.hasProxyKey = true
          server.proxyBalanceRemaining = proxyFixture.balance.remaining
          server.proxyBalanceLimit = proxyFixture.balance.limit
        }
        return Response.json({})
      }

      throw new Error(
        `Unexpected docs settings API request: ${method} ${target.pathname}`
      )
    }
  )

  return { api, calls, servers }
}

describe("docs seed settings fixtures", () => {
  it("registers and converges every server and proxy state across reseeds", async () => {
    const { api, calls, servers } = createDocsSeedSettingsApi()
    const readPluginServerKey = async () => "docs-test-plugin-server-key"
    const seedTime = Date.parse("2026-10-18T00:00:00.000Z")

    await seedDocsSettings(api, seedTime, { readPluginServerKey })

    expect(servers).toHaveLength(3)
    expect(
      servers.map((server) => ({
        baseUrl: server.baseUrl,
        enabled: server.enabled,
        hasProxyKey: server.hasProxyKey,
        proxyEnabled: server.proxyEnabled,
        proxyBalanceRemaining: server.proxyBalanceRemaining,
        proxyBalanceLimit: server.proxyBalanceLimit,
        verificationStatus: server.verificationStatus,
      }))
    ).toEqual([
      {
        baseUrl: "http://localhost:8788",
        enabled: true,
        hasProxyKey: true,
        proxyEnabled: true,
        proxyBalanceRemaining: 4_210,
        proxyBalanceLimit: 5_000,
        verificationStatus: "verified",
      },
      {
        baseUrl: "http://localhost:8789",
        enabled: true,
        hasProxyKey: true,
        proxyEnabled: false,
        proxyBalanceRemaining: 137,
        proxyBalanceLimit: 5_000,
        verificationStatus: "verified",
      },
      {
        baseUrl: "http://localhost:8790",
        enabled: false,
        hasProxyKey: false,
        proxyEnabled: false,
        proxyBalanceRemaining: null,
        proxyBalanceLimit: null,
        verificationStatus: "verified",
      },
    ])

    const archive = servers.find((server) => server.baseUrl.endsWith(":8790"))
    if (!archive) {
      throw new Error("The archive fixture server was not registered.")
    }
    archive.verificationStatus = "stale"
    archive.hasProxyKey = true
    archive.proxyEnabled = true
    archive.proxyBalanceRemaining =
      DOCS_SEED_PROXY_FIXTURES.healthy.balance.remaining
    archive.proxyBalanceLimit = DOCS_SEED_PROXY_FIXTURES.healthy.balance.limit

    const reseedCallStart = calls.length
    await seedDocsSettings(api, seedTime, { readPluginServerKey })
    const reseedCalls = calls.slice(reseedCallStart)

    expect(
      reseedCalls.filter(
        (call) => call.method === "POST" && call.path.endsWith("/refresh")
      )
    ).toHaveLength(3)
    const archiveProxyToggleIndex = reseedCalls.findIndex(
      (call) =>
        call.path === "/api/plugin-servers/8790/proxy/toggle" &&
        call.body?.enabled === false
    )
    const archiveKeyRemovalIndex = reseedCalls.findIndex(
      (call) =>
        call.path === "/api/plugin-servers/8790/proxy/key" &&
        call.body?.token === ""
    )
    expect(archiveProxyToggleIndex).toBeGreaterThanOrEqual(0)
    expect(archiveKeyRemovalIndex).toBeGreaterThan(archiveProxyToggleIndex)
    expect(archive).toMatchObject({
      enabled: false,
      verificationStatus: "verified",
      hasProxyKey: false,
      proxyEnabled: false,
      proxyBalanceRemaining: null,
      proxyBalanceLimit: null,
    })
    expect(
      DOCS_SEED_PLUGIN_SERVER_FIXTURES.map((fixture) => fixture.url)
    ).toEqual(servers.map((server) => server.baseUrl))
  })
})
