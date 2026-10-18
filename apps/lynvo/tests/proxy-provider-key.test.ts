import { Effect, Layer } from "effect"
import { afterEach, describe, expect, it, vi } from "vitest"

import { CloudflareEnv } from "~/lib/effect/services/cloudflare-env"
import {
  readProxyProviderState,
  readScrapeDoAccountInfo,
  refreshProxyProviderBalance,
  saveProxyProviderKey,
} from "~/lib/effect/services/proxy-provider-key"

import { DOCS_SEED_PROXY_KEY } from "../shared/docs-seed-constants"
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

const proxyProviderRow = {
  user_id: "user-1",
  provider: "scrape-do",
  token_ciphertext: "proxy-ciphertext",
  token_nonce: "proxy-nonce",
  token_algorithm: "AES-256-GCM",
  token_version: 1,
  balance_remaining: 973,
  balance_limit: 1_000,
  balance_checked_at: 1,
  created_at: 1,
  updated_at: 1,
}

const createVault = (ciphertextResponse: () => Response) => {
  const vaultNames: string[] = []
  return {
    vaultNames,
    vault: {
      getByName: (name: string) => {
        vaultNames.push(name)
        return { fetch: async () => ciphertextResponse() }
      },
    },
  }
}

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

  it("rejects responses over the account-info byte limit", async () => {
    await expect(
      Effect.runPromise(
        readScrapeDoAccountInfo("user-token", () =>
          accountResponse("x".repeat(16 * 1024 + 1))
        )
      )
    ).rejects.toThrow(
      "Scrape.do account information is unavailable. Try again."
    )
  })
})

describe("readProxyProviderState", () => {
  it("reads the account-level provider state", async () => {
    const database = createFakeD1Database((sql) => {
      if (sql.includes("FROM user_proxy_providers")) {
        return { row: proxyProviderRow, rows: [proxyProviderRow] }
      }
      return undefined
    })
    // SAFETY: This service test supplies only the database binding it exercises.
    const environment = { DB: database } as Env

    const result = await Effect.runPromise(
      readProxyProviderState({ id: "user-1" }).pipe(
        Effect.provide(
          Layer.succeed(CloudflareEnv, CloudflareEnv.of(environment))
        )
      )
    )

    expect(result).toEqual({
      provider: "scrape-do",
      hasKey: true,
      balanceRemaining: 973,
      balanceLimit: 1_000,
      balanceCheckedAt: 1,
    })
  })

  it("reports no key when the provider row has no token", async () => {
    const database = createFakeD1Database((sql) => {
      if (sql.includes("FROM user_proxy_providers")) {
        return { row: null, rows: [] }
      }
      return undefined
    })
    // SAFETY: This service test supplies only the database binding it exercises.
    const environment = { DB: database } as Env

    const result = await Effect.runPromise(
      readProxyProviderState({ id: "user-1" }).pipe(
        Effect.provide(
          Layer.succeed(CloudflareEnv, CloudflareEnv.of(environment))
        )
      )
    )

    expect(result).toEqual({
      provider: "scrape-do",
      hasKey: false,
      balanceRemaining: null,
      balanceLimit: null,
      balanceCheckedAt: null,
    })
  })
})

describe("saveProxyProviderKey", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("uses the docs fixture balance in no-auth development mode", async () => {
    let insertArgs: unknown[] | undefined
    const database = createFakeD1Database((sql, args) => {
      if (sql.includes("INSERT INTO user_proxy_providers")) {
        insertArgs = args
      }
      return undefined
    })
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal("fetch", fetchMock)
    const { vault, vaultNames } = createVault(() =>
      Response.json({
        ciphertext: "encrypted-proxy-token",
        nonce: "proxy-nonce",
        algorithm: "AES-256-GCM",
        keyVersion: 1,
      })
    )
    // SAFETY: This test enables only the development bypass and mocks the database and credential vault.
    const environment = {
      DB: database,
      ENVIRONMENT: "development",
      LYNVO_NO_AUTH: "true",
      PLUGIN_SERVER_CREDENTIAL_VAULT: vault,
    } as Env

    const result = await Effect.runPromise(
      saveProxyProviderKey({
        token: DOCS_SEED_PROXY_KEY,
        user: { id: "user-1" },
      }).pipe(
        Effect.provide(
          Layer.succeed(CloudflareEnv, CloudflareEnv.of(environment))
        )
      )
    )

    expect(result).toEqual({
      remaining: 4_210,
      limit: 5_000,
      dataVersion: 2,
    })
    expect(insertArgs?.slice(0, 8)).toEqual([
      "user-1",
      "scrape-do",
      "encrypted-proxy-token",
      "proxy-nonce",
      "AES-256-GCM",
      1,
      4_210,
      5_000,
    ])
    expect(fetchMock).not.toHaveBeenCalled()
    expect(vaultNames).toEqual(["user-1:proxy-provider:scrape-do"])
  })

  it("validates other tokens against Scrape.do in no-auth development mode", async () => {
    let insertArgs: unknown[] | undefined
    const database = createFakeD1Database((sql, args) => {
      if (sql.includes("INSERT INTO user_proxy_providers")) {
        insertArgs = args
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
    const { vault } = createVault(() =>
      Response.json({
        ciphertext: "encrypted-proxy-token",
        nonce: "proxy-nonce",
        algorithm: "AES-256-GCM",
        keyVersion: 1,
      })
    )
    // SAFETY: This test enables only the development bypass and mocks the database and credential vault.
    const environment = {
      DB: database,
      ENVIRONMENT: "development",
      LYNVO_NO_AUTH: "true",
      PLUGIN_SERVER_CREDENTIAL_VAULT: vault,
    } as Env

    const result = await Effect.runPromise(
      saveProxyProviderKey({
        token: "user-scrape-token",
        user: { id: "user-1" },
      }).pipe(
        Effect.provide(
          Layer.succeed(CloudflareEnv, CloudflareEnv.of(environment))
        )
      )
    )

    expect(result).toEqual({
      remaining: 901,
      limit: 1_000,
      dataVersion: 2,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.scrape.do/info?token=user-scrape-token",
      expect.objectContaining({
        headers: { Accept: "application/json" },
        signal: expect.any(AbortSignal),
      })
    )
    expect(insertArgs?.slice(0, 8)).toEqual([
      "user-1",
      "scrape-do",
      "encrypted-proxy-token",
      "proxy-nonce",
      "AES-256-GCM",
      1,
      901,
      1_000,
    ])
  })

  it("deletes the saved key when given an empty token", async () => {
    let deleteArgs: unknown[] | undefined
    const database = createFakeD1Database((sql, args) => {
      if (sql.includes("DELETE FROM user_proxy_providers")) {
        deleteArgs = args
      }
      return undefined
    })
    // SAFETY: This service test supplies only the database binding it exercises.
    const environment = { DB: database } as Env

    const result = await Effect.runPromise(
      saveProxyProviderKey({
        token: "  ",
        user: { id: "user-1" },
      }).pipe(
        Effect.provide(
          Layer.succeed(CloudflareEnv, CloudflareEnv.of(environment))
        )
      )
    )

    expect(result).toEqual({ remaining: null, limit: null, dataVersion: 2 })
    expect(deleteArgs).toEqual(["user-1", "scrape-do"])
  })

  it("reports a failed empty-token removal", async () => {
    const database = createFakeD1Database((sql) => {
      if (sql.includes("DELETE FROM user_proxy_providers")) {
        return { error: new Error("database write failed") }
      }
      return undefined
    })
    // SAFETY: This service test supplies only the database binding it exercises.
    const environment = { DB: database } as Env

    await expect(
      Effect.runPromise(
        saveProxyProviderKey({
          token: "",
          user: { id: "user-1" },
        }).pipe(
          Effect.provide(
            Layer.succeed(CloudflareEnv, CloudflareEnv.of(environment))
          )
        )
      )
    ).rejects.toThrow("The proxy key couldn’t be removed.")
  })
})

describe("refreshProxyProviderBalance", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("revalidates the stored account token and saves the balance", async () => {
    let balanceUpdateArgs: unknown[] | undefined
    let providerLookupArgs: unknown[] | undefined
    const database = createFakeD1Database((sql, args) => {
      if (sql.includes("FROM user_proxy_providers")) {
        providerLookupArgs = args
        return { row: proxyProviderRow, rows: [proxyProviderRow] }
      }
      if (sql.includes("UPDATE user_proxy_providers SET balance_remaining")) {
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
    const { vault, vaultNames } = createVault(() =>
      Response.json({ apiKey: "stored-proxy-token" })
    )
    // SAFETY: The refresh test only needs the database and credential-vault bindings.
    const environment = {
      DB: database,
      PLUGIN_SERVER_CREDENTIAL_VAULT: vault,
    } as Env

    const result = await Effect.runPromise(
      refreshProxyProviderBalance({ user: { id: "user-1" } }).pipe(
        Effect.provide(
          Layer.succeed(CloudflareEnv, CloudflareEnv.of(environment))
        )
      )
    )

    expect(result).toMatchObject({
      success: true,
      remaining: 901,
      limit: 1_000,
      dataVersion: 2,
    })
    expect(providerLookupArgs).toEqual(["user-1", "scrape-do"])
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.scrape.do/info?token=stored-proxy-token",
      expect.objectContaining({ headers: { Accept: "application/json" } })
    )
    expect(balanceUpdateArgs?.slice(0, 4)).toEqual([
      "user-1",
      "scrape-do",
      901,
      1_000,
    ])
    expect(vaultNames).toEqual(["user-1:proxy-provider:scrape-do"])
  })

  it("fails when no key is saved", async () => {
    const database = createFakeD1Database((sql) => {
      if (sql.includes("FROM user_proxy_providers")) {
        return { row: null, rows: [] }
      }
      return undefined
    })
    // SAFETY: This service test supplies only the database binding it exercises.
    const environment = { DB: database } as Env

    await expect(
      Effect.runPromise(
        refreshProxyProviderBalance({ user: { id: "user-1" } }).pipe(
          Effect.provide(
            Layer.succeed(CloudflareEnv, CloudflareEnv.of(environment))
          )
        )
      )
    ).rejects.toThrow("Save a proxy key before refreshing its balance.")
  })
})
