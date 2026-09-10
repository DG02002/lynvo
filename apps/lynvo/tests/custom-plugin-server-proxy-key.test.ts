import { Effect, Layer } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CloudflareEnv } from "~/lib/effect/services/cloudflare-env"
import {
  readScrapeDoAccountInfo,
  refreshCustomPluginServerProxyBalance,
} from "~/lib/effect/services/custom-plugin-server-proxy-key"
import { createFakeD1Database } from "./support/fake-d1"

const accountResponse = (body: string, status = 200) =>
  Promise.resolve(
    new Response(body, {
      status,
      headers: { "Content-Type": "application/json" },
    })
  )

interface ScrapeDoAccountPayload {
  IsActive: boolean
  RemainingMonthlyRequest: number
  MaxMonthlyRequest: number
}

const accountJson = (value: ScrapeDoAccountPayload) => JSON.stringify(value)

describe("readScrapeDoAccountInfo", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns the monthly balance for an active token", async () => {
    const result = await Effect.runPromise(
      readScrapeDoAccountInfo("user-token", () =>
        accountResponse(
          accountJson({
            IsActive: true,
            RemainingMonthlyRequest: 973,
            MaxMonthlyRequest: 1000,
          })
        )
      )
    )

    expect(result).toEqual({ remaining: 973, limit: 1000 })
  })

  it("fails on rejected tokens", async () => {
    await expect(
      Effect.runPromise(
        readScrapeDoAccountInfo("bad-token", () =>
          accountResponse(JSON.stringify({ error: "invalid token" }), 401)
        )
      )
    ).rejects.toThrow("Scrape.do rejected this API token.")
  })

  it("fails on inactive subscriptions", async () => {
    await expect(
      Effect.runPromise(
        readScrapeDoAccountInfo("inactive-token", () =>
          accountResponse(
            accountJson({
              IsActive: false,
              RemainingMonthlyRequest: 0,
              MaxMonthlyRequest: 1000,
            })
          )
        )
      )
    ).rejects.toThrow("subscription is not active")
  })

  it("fails on unrecognized payloads", async () => {
    await expect(
      Effect.runPromise(
        readScrapeDoAccountInfo("user-token", () => accountResponse("[]"))
      )
    ).rejects.toThrow("unrecognized response")
  })
})

describe("refreshCustomPluginServerProxyBalance", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("revalidates the stored token and writes the new balance", async () => {
    const serverRow = {
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
      proxy_enabled: 1,
      credential_status: "ready",
      credential_generation: 1,
      credential_attempt_id: null,
      pending_expires_at: null,
      failure_reason: null,
      manifest: JSON.stringify({
        protocolVersion: "1.0",
        pluginServerId: "dev.example.plugin-server",
        displayName: "Proxy Capable",
        auth: { type: "bearer" },
        usage: { endpoint: "/usage" },
        matchers: [{ hosts: ["example.com"] }],
        features: {},
        extensions: {
          lynvo: { proxyProvider: "scrape-do", plugins: [] },
        },
      }),
      enabled: 1,
      priority: 0,
      verification_status: "verified",
      last_verified_at: 1,
      last_manifest_refresh_at: 1,
      created_at: 1,
      updated_at: 1,
    }
    let balanceUpdateArgs: unknown[] | undefined
    const database = createFakeD1Database((sql, args) => {
      if (sql.includes("FROM user_plugin_servers")) {
        return { row: serverRow, rows: [serverRow] }
      }
      if (
        sql.includes("UPDATE user_plugin_servers SET proxy_balance_remaining")
      ) {
        balanceUpdateArgs = args
      }
      return undefined
    })
    const fetchMock = vi.fn(async () =>
      Response.json({
        IsActive: true,
        RemainingMonthlyRequest: 901,
        MaxMonthlyRequest: 1_000,
      })
    )
    vi.stubGlobal("fetch", fetchMock)
    // SAFETY: The refresh test only needs the database and credential-vault bindings.
    const environment = {
      DB: database,
      PLUGIN_SERVER_CREDENTIAL_VAULT: {
        getByName: () => ({
          fetch: async () => Response.json({ apiKey: "stored-proxy-token" }),
        }),
      },
    } as Env

    const result = await Effect.runPromise(
      refreshCustomPluginServerProxyBalance({
        pluginServerId: "plugin-server-1",
        user: { id: "user-1" },
      }).pipe(
        Effect.provide(
          Layer.succeed(CloudflareEnv, CloudflareEnv.of(environment))
        )
      )
    )

    expect(result).toMatchObject({
      success: true,
      remaining: 901,
      limit: 1_000,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.scrape.do/info?token=stored-proxy-token",
      expect.objectContaining({ headers: { Accept: "application/json" } })
    )
    expect(balanceUpdateArgs?.slice(0, 3)).toEqual([
      "plugin-server-1",
      901,
      1_000,
    ])
  })
})
