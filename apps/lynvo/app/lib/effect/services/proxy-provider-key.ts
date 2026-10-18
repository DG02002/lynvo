import { readBoundedResponseText } from "@dg02002/lynvo-plugin-server-protocol"
import { Effect, Result, Schema } from "effect"

import {
  DOCS_SEED_PROXY_BALANCE,
  DOCS_SEED_PROXY_KEY,
} from "../../../../shared/docs-seed-constants"
import {
  readProxyProviderState as readProxyProviderStateRow,
  readSealedProxyProviderToken,
  saveProxyProviderKey as persistProxyProviderKey,
  updateProxyProviderBalance,
  type ProxyProviderState,
} from "../../../../workers/d1/proxy-providers"
import {
  isDevelopmentAuthBypassEnabled,
  type DevelopmentAuthEnvironment,
} from "../../../../workers/d1/sessions"
import { isProxyTokenRemoval } from "../../plugin-server-proxy"
import {
  BackendError,
  PluginServerRegistrationError,
  toPluginServerRegistrationError,
} from "../errors"
import {
  requireDatabaseEffect,
  requireDatabaseEffectAs,
} from "../require-database"
import { CloudflareEnv } from "./cloudflare-env"
import {
  decryptProxyProviderToken,
  encryptProxyProviderToken,
} from "./custom-plugin-server-credentials"

interface ProxyProviderUser {
  readonly id: string
}

export interface SaveProxyProviderKeyInput {
  /** An empty token removes the saved proxy key. */
  readonly token: string
  readonly user: ProxyProviderUser
}

export interface ProxyKeyBalance {
  readonly remaining: number | null
  readonly limit: number | null
  readonly dataVersion: number
}

const ScrapeDoAccountInfo = Schema.Struct({
  IsActive: Schema.Boolean,
  RemainingMonthlyRequest: Schema.Number,
  MaxMonthlyRequest: Schema.Number,
})

interface ProxyAccountInfo {
  readonly remaining: number
  readonly limit: number
}

const SCRAPE_DO_INFO_URL = "https://api.scrape.do/info"
const SCRAPE_DO_INFO_MAX_RESPONSE_BYTES = 16 * 1024

/**
 * Validates a Scrape.do token against the free account-info endpoint. The
 * fetch is injectable so tests never touch the network.
 */
export const readScrapeDoAccountInfo = Effect.fn(
  "ProxyProviderKey.readScrapeDoAccountInfo"
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
    try: () =>
      readBoundedResponseText(response, {
        maximumResponseBytes: SCRAPE_DO_INFO_MAX_RESPONSE_BYTES,
      }),
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

// No-auth development seeds save this demo proxy key so the proxy settings page
// can show a credit balance without a real Scrape.do account.
const readProxyAccountInfo = (
  environment: DevelopmentAuthEnvironment,
  token: string
): Effect.Effect<ProxyAccountInfo, Error> => {
  if (
    isDevelopmentAuthBypassEnabled(environment) &&
    token === DOCS_SEED_PROXY_KEY
  ) {
    return Effect.succeed<ProxyAccountInfo>({ ...DOCS_SEED_PROXY_BALANCE })
  }
  return readScrapeDoAccountInfo(token)
}

export const readProxyProviderState = Effect.fn("ProxyProviderKey.readState")(
  function* (
    user: ProxyProviderUser
  ): Effect.fn.Return<ProxyProviderState, BackendError, CloudflareEnv> {
    const environment = yield* CloudflareEnv
    const database = yield* requireDatabaseEffect(
      environment,
      "Proxy settings couldn’t be loaded."
    )
    return yield* Effect.tryPromise({
      try: () => readProxyProviderStateRow(database, user.id),
      catch: (cause) =>
        new BackendError({
          message: "Proxy settings couldn’t be loaded.",
          cause,
        }),
    })
  }
)

export const saveProxyProviderKey = Effect.fn("ProxyProviderKey.save")(
  function* (
    input: SaveProxyProviderKeyInput
  ): Effect.fn.Return<
    ProxyKeyBalance,
    PluginServerRegistrationError,
    CloudflareEnv
  > {
    const environment = yield* CloudflareEnv
    const database = yield* requireDatabaseEffectAs(
      environment,
      toPluginServerRegistrationError
    )

    if (isProxyTokenRemoval(input.token)) {
      const { dataVersion } = yield* Effect.tryPromise({
        try: () =>
          persistProxyProviderKey(database, input.user.id, {
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
      return { remaining: null, limit: null, dataVersion }
    }

    const token = input.token.trim()
    const balance = yield* readProxyAccountInfo(environment, token).pipe(
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
    const encrypted = yield* encryptProxyProviderToken({
      environment,
      userId: input.user.id,
      provider: "scrape-do",
      token,
    }).pipe(
      Effect.mapError(
        (error) => new PluginServerRegistrationError({ message: error.message })
      )
    )
    const { dataVersion } = yield* Effect.tryPromise({
      try: () =>
        persistProxyProviderKey(database, input.user.id, {
          encrypted,
          balance,
          now: Date.now(),
        }),
      catch: (cause) =>
        new PluginServerRegistrationError({
          message: "The proxy key couldn’t be saved.",
          details: cause,
        }),
    })
    return { ...balance, dataVersion }
  }
)

export interface RefreshProxyProviderBalanceInput {
  readonly user: ProxyProviderUser
}

export const refreshProxyProviderBalance = Effect.fn(
  "ProxyProviderKey.refreshBalance"
)(function* (input: RefreshProxyProviderBalanceInput): Effect.fn.Return<
  {
    success: true
    remaining: number
    limit: number
    checkedAt: number
    dataVersion: number
  },
  PluginServerRegistrationError,
  CloudflareEnv
> {
  const environment = yield* CloudflareEnv
  const database = yield* requireDatabaseEffectAs(
    environment,
    toPluginServerRegistrationError
  )

  const sealed = yield* Effect.tryPromise({
    try: () => readSealedProxyProviderToken(database, input.user.id),
    catch: (cause) =>
      new PluginServerRegistrationError({
        message: "The proxy balance couldn’t be refreshed.",
        details: cause,
      }),
  })
  if (!sealed) {
    return yield* new PluginServerRegistrationError({
      message: "Save a proxy key before refreshing its balance.",
    })
  }

  const proxyToken = yield* decryptProxyProviderToken({
    environment,
    userId: input.user.id,
    provider: "scrape-do",
    sealed,
  }).pipe(
    Effect.mapError(
      (error) => new PluginServerRegistrationError({ message: error.message })
    )
  )

  const balance = yield* readProxyAccountInfo(environment, proxyToken).pipe(
    Effect.mapError(
      (cause) =>
        new PluginServerRegistrationError({
          message:
            cause instanceof Error
              ? cause.message
              : "The proxy balance couldn’t be refreshed.",
        })
    )
  )
  const checkedAt = Date.now()
  const { dataVersion } = yield* Effect.tryPromise({
    try: () =>
      updateProxyProviderBalance(database, input.user.id, {
        balance,
        now: checkedAt,
      }),
    catch: (cause) =>
      new PluginServerRegistrationError({
        message: "The proxy balance couldn’t be saved.",
        details: cause,
      }),
  })
  return { success: true, ...balance, checkedAt, dataVersion }
})
