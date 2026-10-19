import { type PluginServerManifest } from "@dg02002/lynvo-plugin-server-protocol"
import { Effect } from "effect"

import { getErrorMessage } from "../app/lib/effect/errors"
import {
  decryptCustomPluginServer,
  decryptProxyProviderToken,
} from "../app/lib/effect/services/custom-plugin-server-credentials"
import { readScrapeDoAccountInfo } from "../app/lib/effect/services/proxy-provider-key"
import {
  HttpPluginServerTransport,
  PluginServerClient,
} from "../app/lib/extraction/plugin-server-client"
import {
  PLUGIN_SERVER_MANIFEST_REFRESH_BATCH_SIZE,
  PLUGIN_SERVER_MANIFEST_REFRESH_CONCURRENCY_COUNT,
  PLUGIN_SERVER_MANIFEST_REFRESH_RETRY_DOWN_INTERVAL_MS,
  PLUGIN_SERVER_MANIFEST_REFRESH_INTERVAL_MS,
  PLUGIN_SERVER_PROXY_BALANCE_REFRESH_INTERVAL_MS,
} from "./constants"
import {
  recordPluginServerRefreshSuccess,
  recordPluginServerVerificationFailure,
} from "./d1/plugin-servers"
import {
  readSealedProxyProviderToken,
  updateProxyProviderBalance,
} from "./d1/proxy-providers"

interface RefreshablePluginServer {
  readonly id: string
  readonly baseUrl: string
  readonly apiKey: string
}

interface RefreshablePluginServerRow {
  readonly id: string
  readonly user_id: string
  readonly base_url: string
  readonly api_key_ciphertext: string | null
  readonly api_key_nonce: string | null
  readonly api_key_algorithm: "AES-256-GCM" | null
  readonly api_key_version: number | null
}

interface RefreshOnePluginServerInput {
  env: Env
  database: D1Database
  row: RefreshablePluginServerRow
  now: number
}

interface LoadRefreshablePluginServerInput {
  env: Env
  row: RefreshablePluginServerRow
}

interface RefreshPluginServerInput {
  env: Env
  database: D1Database
  userId: string
  pluginServer: RefreshablePluginServer
  now: number
}

interface RefreshProxyProviderBalanceInput {
  env: Env
  database: D1Database
  userId: string
  now: number
}

interface ProxyProviderBalanceRefreshStepInput<Value> {
  readonly userId: string
  readonly step: string
  readonly operation: () => Promise<Value>
}

const runProxyProviderBalanceRefreshStep = async <Value>({
  userId,
  step,
  operation,
}: ProxyProviderBalanceRefreshStepInput<Value>): Promise<Value | undefined> => {
  try {
    return await operation()
  } catch (error) {
    console.warn("proxy_provider_balance_refresh_failed", {
      step,
      user_id: userId,
      error: getErrorMessage(error),
    })
    return undefined
  }
}

const groupRefreshRowsByUser = (
  rows: ReadonlyArray<RefreshablePluginServerRow>
): ReadonlyArray<ReadonlyArray<RefreshablePluginServerRow>> => {
  const rowsByUser = new Map<string, RefreshablePluginServerRow[]>()
  for (const row of rows) {
    const userRows = rowsByUser.get(row.user_id)
    if (userRows) {
      userRows.push(row)
    } else {
      rowsByUser.set(row.user_id, [row])
    }
  }
  return Array.from(rowsByUser.values())
}

const loadRefreshablePluginServer = Effect.fn(
  "PluginServerManifestRefresh.loadRefreshablePluginServer"
)(function* ({ env, row }: LoadRefreshablePluginServerInput) {
  const storedPluginServer = {
    id: row.id,
    baseUrl: row.base_url,
    apiKeyCiphertext: row.api_key_ciphertext ?? undefined,
    apiKeyNonce: row.api_key_nonce ?? undefined,
    apiKeyAlgorithm: row.api_key_algorithm ?? undefined,
    apiKeyVersion: row.api_key_version ?? undefined,
  }
  return yield* decryptCustomPluginServer(env, row.user_id, storedPluginServer)
})

const refreshPluginServer = async ({
  env,
  database,
  userId,
  pluginServer,
  now,
}: RefreshPluginServerInput): Promise<void> => {
  const client = new PluginServerClient(
    new HttpPluginServerTransport(pluginServer.baseUrl)
  )
  const manifest: PluginServerManifest = await client.getManifest({
    apiKey: pluginServer.apiKey,
  })
  await recordPluginServerRefreshSuccess(database, userId, {
    id: pluginServer.id,
    manifest: JSON.stringify(manifest),
    now,
    realtime: env.USER_REALTIME_ROOM,
  })
}

const refreshOnePluginServer = async ({
  env,
  database,
  row,
  now,
}: RefreshOnePluginServerInput): Promise<boolean> => {
  try {
    const pluginServer = await Effect.runPromise(
      loadRefreshablePluginServer({ env, row })
    )
    await refreshPluginServer({
      env,
      database,
      userId: row.user_id,
      pluginServer,
      now,
    })
    return true
  } catch (error) {
    console.warn("plugin_server_manifest_refresh_failed", {
      operation: "plugin_server_manifest_refresh_failed",
      plugin_server_id: row.id,
      user_id: row.user_id,
      error: error instanceof Error ? error.message : String(error),
    })
    await recordPluginServerVerificationFailure(database, row.user_id, {
      id: row.id,
      now,
      realtime: env.USER_REALTIME_ROOM,
    }).catch(() => undefined)
    return false
  }
}

// The proxy key is account-level, so its balance refreshes once per user
// instead of once per server.
const refreshProxyProviderBalanceIfDue = async ({
  env,
  database,
  userId,
  now,
}: RefreshProxyProviderBalanceInput): Promise<void> => {
  const sealed = await runProxyProviderBalanceRefreshStep({
    userId,
    step: "read_key",
    operation: () => readSealedProxyProviderToken(database, userId),
  })
  if (!sealed) {
    return
  }
  const stateRow = await runProxyProviderBalanceRefreshStep({
    userId,
    step: "read_balance_state",
    operation: () =>
      database
        .prepare(
          "SELECT balance_checked_at FROM user_proxy_providers WHERE user_id = ?1 AND provider = 'scrape-do'"
        )
        .bind(userId)
        .first<{ balance_checked_at: number | null }>(),
  })
  if (stateRow === undefined) {
    // Retry on the next scheduled run instead of making an unconditional provider call.
    return
  }
  if (
    stateRow &&
    stateRow.balance_checked_at !== null &&
    now - stateRow.balance_checked_at <
      PLUGIN_SERVER_PROXY_BALANCE_REFRESH_INTERVAL_MS
  ) {
    return
  }
  const proxyToken = await runProxyProviderBalanceRefreshStep({
    userId,
    step: "decrypt_key",
    operation: () =>
      Effect.runPromise(
        decryptProxyProviderToken({
          environment: env,
          userId,
          provider: "scrape-do",
          sealed,
        })
      ),
  })
  if (proxyToken === undefined) {
    return
  }
  const balance = await runProxyProviderBalanceRefreshStep({
    userId,
    step: "read_balance",
    operation: () => Effect.runPromise(readScrapeDoAccountInfo(proxyToken)),
  })
  if (!balance) {
    return
  }
  await runProxyProviderBalanceRefreshStep({
    userId,
    step: "save_balance",
    operation: () =>
      updateProxyProviderBalance(database, userId, {
        balance,
        now,
        realtime: env.USER_REALTIME_ROOM,
      }),
  })
}

export const refreshCustomPluginServerManifests = async (
  env: Env,
  database: D1Database
): Promise<{ refreshed: number; failed: number }> => {
  const now = Date.now()
  const { results } = await database
    .prepare(
      `SELECT id, user_id, base_url, api_key_ciphertext, api_key_nonce,
              api_key_algorithm, api_key_version
       FROM user_plugin_servers
       WHERE credential_status = 'ready'
         AND (
           last_manifest_refresh_at IS NULL
           OR last_manifest_refresh_at <= ?1
           OR (
             verification_status = 'down'
             AND (last_manifest_refresh_at IS NULL OR last_manifest_refresh_at <= ?2)
           )
         )
       ORDER BY COALESCE(last_manifest_refresh_at, 0), user_id, id
       LIMIT ?3`
    )
    .bind(
      now - PLUGIN_SERVER_MANIFEST_REFRESH_INTERVAL_MS,
      now - PLUGIN_SERVER_MANIFEST_REFRESH_RETRY_DOWN_INTERVAL_MS,
      PLUGIN_SERVER_MANIFEST_REFRESH_BATCH_SIZE
    )
    .all<RefreshablePluginServerRow>()
  const userGroups = groupRefreshRowsByUser(results)
  const refreshResultGroups = await Effect.runPromise(
    Effect.forEach(
      userGroups,
      (userRows) =>
        Effect.gen(function* () {
          const refreshResults = yield* Effect.forEach(userRows, (row) =>
            Effect.promise(() =>
              refreshOnePluginServer({ env, database, row, now })
            )
          )
          yield* Effect.promise(() =>
            refreshProxyProviderBalanceIfDue({
              env,
              database,
              userId: userRows[0].user_id,
              now,
            })
          )
          return refreshResults
        }),
      { concurrency: PLUGIN_SERVER_MANIFEST_REFRESH_CONCURRENCY_COUNT }
    )
  )
  const refreshResults = refreshResultGroups.flat()
  const refreshed = refreshResults.filter(Boolean).length
  return { refreshed, failed: refreshResults.length - refreshed }
}
