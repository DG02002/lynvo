import { Effect, Result, Schema } from "effect"
import { getLynvoManifestExtension } from "@dg02002/lynvo-plugin-server-protocol"
import { CloudflareEnv } from "./cloudflare-env"
import { getD1Database } from "../../../../workers/d1/db"
import { updatePluginServerProxyKey } from "../../../../workers/d1/plugin-servers"
import { encryptCustomPluginServerApiKey } from "./custom-plugin-server-credentials"
import { PluginServerRegistrationError } from "../errors"
import { decodePluginServerManifest } from "./custom-plugin-server-adapter"

export interface CustomPluginServerProxyKeyUser {
  readonly id: string
}

export interface SaveCustomPluginServerProxyKeyInput {
  readonly pluginServerId: string
  /** An empty token removes the saved proxy key. */
  readonly token: string
  readonly user: CustomPluginServerProxyKeyUser
}

export interface ProxyKeyBalance {
  readonly remaining: number | null
  readonly limit: number | null
}

const ScrapeDoAccountInfo = Schema.Struct({
  IsActive: Schema.Boolean,
  RemainingMonthlyRequest: Schema.Number,
  MaxMonthlyRequest: Schema.Number,
})

export const SCRAPE_DO_INFO_URL = "https://api.scrape.do/info"

/**
 * Validates a Scrape.do token against the free account-info endpoint. The
 * fetch is injectable so tests never touch the network.
 */
export const readScrapeDoAccountInfo = Effect.fn(
  "CustomPluginServerProxyKey.readScrapeDoAccountInfo"
)(function* (token: string, fetchFn: typeof fetch = fetch) {
  const response = yield* Effect.tryPromise({
    try: () =>
      fetchFn(`${SCRAPE_DO_INFO_URL}?token=${encodeURIComponent(token)}`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10_000),
      }),
    catch: () =>
      new Error("Scrape.do account information is unavailable. Try again."),
  })
  if (response.status === 401 || response.status === 403) {
    return yield* Effect.fail(new Error("Scrape.do rejected this API token."))
  }
  if (!response.ok) {
    return yield* Effect.fail(
      new Error("Scrape.do account information is unavailable. Try again.")
    )
  }
  const text = yield* Effect.tryPromise({
    try: () => response.text(),
    catch: () =>
      new Error("Scrape.do account information is unavailable. Try again."),
  })
  const value = yield* Effect.try({
    // SAFETY: JSON.parse returns arbitrary data validated by ScrapeDoAccountInfo.
    try: () => JSON.parse(text) as unknown,
    catch: () => new Error("Scrape.do returned an unrecognized response."),
  })
  const parsed = Schema.decodeUnknownResult(ScrapeDoAccountInfo)(value)
  if (Result.isFailure(parsed)) {
    return yield* Effect.fail(
      new Error("Scrape.do returned an unrecognized response.")
    )
  }
  if (!parsed.success.IsActive) {
    return yield* Effect.fail(
      new Error("This Scrape.do subscription is not active.")
    )
  }
  return {
    remaining: parsed.success.RemainingMonthlyRequest,
    limit: parsed.success.MaxMonthlyRequest,
  }
})

export const saveCustomPluginServerProxyKey = Effect.fn(
  "CustomPluginServerProxyKey.save"
)(function* (
  input: SaveCustomPluginServerProxyKeyInput
): Effect.fn.Return<
  ProxyKeyBalance,
  PluginServerRegistrationError,
  CloudflareEnv
> {
  const environment = yield* CloudflareEnv
  const database = getD1Database(environment)
  if (!database) {
    return yield* new PluginServerRegistrationError({
      message: "Account data is temporarily unavailable.",
    })
  }
  const stored = yield* Effect.tryPromise({
    try: () =>
      database
        .prepare(
          "SELECT id, manifest FROM user_plugin_servers WHERE id = ?1 AND user_id = ?2"
        )
        .bind(input.pluginServerId, input.user.id)
        .first<{ id: string; manifest: string }>(),
    catch: (cause) =>
      new PluginServerRegistrationError({
        message: "Plugin server lookup failed.",
        details: cause,
      }),
  })
  if (!stored) {
    return yield* new PluginServerRegistrationError({
      message: "Plugin server not found.",
    })
  }
  const manifest = yield* decodePluginServerManifest(stored.manifest)
  if (
    !manifest ||
    getLynvoManifestExtension(manifest).proxyProvider !== "scrape-do"
  ) {
    return yield* new PluginServerRegistrationError({
      message: "This Plugin Server does not support user proxy keys.",
    })
  }

  if (input.token.trim() === "") {
    yield* Effect.tryPromise({
      try: () =>
        updatePluginServerProxyKey(database, input.user.id, {
          id: stored.id,
          encrypted: null,
          balance: null,
          now: Date.now(),
        }),
      catch: (cause) =>
        new PluginServerRegistrationError({
          message: "The proxy key couldn’t be removed.",
          details: cause,
        }),
    })
    return { remaining: null, limit: null }
  }

  const token = input.token.trim()
  const balance = yield* readScrapeDoAccountInfo(token).pipe(
    Effect.mapError(
      (cause) =>
        new PluginServerRegistrationError({
          message:
            cause instanceof Error
              ? cause.message
              : "The Scrape.do proxy key couldn’t be validated.",
        })
    )
  )
  const encrypted = yield* encryptCustomPluginServerApiKey({
    environment,
    userId: input.user.id,
    pluginServerId: stored.id,
    apiKey: token,
  }).pipe(
    Effect.mapError(
      (error) => new PluginServerRegistrationError({ message: error.message })
    )
  )
  yield* Effect.tryPromise({
    try: () =>
      updatePluginServerProxyKey(database, input.user.id, {
        id: stored.id,
        encrypted: {
          ciphertext: encrypted.apiKeyCiphertext,
          nonce: encrypted.apiKeyNonce,
          algorithm: encrypted.apiKeyAlgorithm,
          version: encrypted.apiKeyVersion,
        },
        balance,
        now: Date.now(),
      }),
    catch: (cause) =>
      new PluginServerRegistrationError({
        message: "The proxy key couldn’t be saved.",
        details: cause,
      }),
  })
  return balance
})
