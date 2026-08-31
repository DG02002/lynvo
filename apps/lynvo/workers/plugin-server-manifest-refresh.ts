import {
  HttpPluginServerTransport,
  PluginServerClient,
} from "../app/lib/extraction/plugin-server-client"
import {
  getLynvoManifestExtension,
  type PluginServerManifest,
} from "@dg02002/lynvo-plugin-server-protocol"
import { Effect } from "effect"
import {
  decryptCustomPluginServer,
  decryptCustomPluginServerProxyToken,
} from "../app/lib/effect/services/custom-plugin-server-credentials"
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
  updatePluginServerProxyBalance,
} from "./d1/plugin-servers"
import { readScrapeDoAccountInfo } from "../app/lib/effect/services/custom-plugin-server-proxy-key"
import { notifyAccountDataChanged } from "./d1/data-version-notification"

interface RefreshablePluginServer {
  readonly id: string
  readonly baseUrl: string
  readonly apiKey: string
  readonly proxyToken?: string
  readonly proxyBalanceCheckedAt?: number | null
}

interface RefreshablePluginServerRow {
  readonly id: string
  readonly user_id: string
  readonly base_url: string
  readonly api_key_ciphertext: string | null
  readonly api_key_nonce: string | null
  readonly api_key_algorithm: "AES-256-GCM" | null
  readonly api_key_version: number | null
  readonly proxy_token_ciphertext: string | null
  readonly proxy_token_nonce: string | null
  readonly proxy_token_algorithm: "AES-256-GCM" | null
  readonly proxy_token_version: number | null
  readonly proxy_balance_checked_at: number | null
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

interface RefreshProxyBalanceInput {
  database: D1Database
  userId: string
  manifest: PluginServerManifest
  pluginServer: RefreshablePluginServer
  now: number
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
    proxyTokenCiphertext: row.proxy_token_ciphertext,
    proxyTokenNonce: row.proxy_token_nonce,
    proxyTokenAlgorithm: row.proxy_token_algorithm,
    proxyTokenVersion: row.proxy_token_version,
    proxyBalanceCheckedAt: row.proxy_balance_checked_at,
  }
  const decryptedPluginServer = yield* decryptCustomPluginServer(
    env,
    row.user_id,
    storedPluginServer
  )
  const proxyToken = yield* decryptCustomPluginServerProxyToken(
    env,
    row.user_id,
    storedPluginServer
  )
  return proxyToken === undefined
    ? decryptedPluginServer
    : { ...decryptedPluginServer, proxyToken }
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
  const manifest = await client.getManifest({ apiKey: pluginServer.apiKey })
  await refreshProxyBalanceIfDue({
    database,
    userId,
    manifest,
    pluginServer,
    now,
  })
  const result = await recordPluginServerRefreshSuccess(database, userId, {
    id: pluginServer.id,
    manifest: JSON.stringify(manifest),
    now,
  })
  await notifyAccountDataChanged(env, userId, result.dataVersion).catch(
    () => undefined
  )
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
    }).catch(() => undefined)
    return false
  }
}

const refreshProxyBalanceIfDue = async ({
  database,
  userId,
  manifest,
  pluginServer,
  now,
}: RefreshProxyBalanceInput): Promise<void> => {
  if (
    getLynvoManifestExtension(manifest).proxyProvider !== "scrape-do" ||
    !pluginServer.proxyToken ||
    (pluginServer.proxyBalanceCheckedAt !== null &&
      pluginServer.proxyBalanceCheckedAt !== undefined &&
      now - pluginServer.proxyBalanceCheckedAt <
        PLUGIN_SERVER_PROXY_BALANCE_REFRESH_INTERVAL_MS)
  ) {
    return
  }
  const balance = await Effect.runPromise(
    readScrapeDoAccountInfo(pluginServer.proxyToken)
  ).catch(() => undefined)
  if (balance) {
    await updatePluginServerProxyBalance(database, userId, {
      id: pluginServer.id,
      balance,
      now,
    }).catch(() => undefined)
  }
}

export const refreshCustomPluginServerManifests = async (
  env: Env,
  database: D1Database
): Promise<{ refreshed: number; failed: number }> => {
  const now = Date.now()
  const { results } = await database
    .prepare(
      `SELECT id, user_id, base_url, api_key_ciphertext, api_key_nonce,
              api_key_algorithm, api_key_version, proxy_token_ciphertext,
              proxy_token_nonce, proxy_token_algorithm, proxy_token_version,
              proxy_balance_checked_at
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
  const refreshResultGroups = await Effect.runPromise(
    Effect.forEach(
      groupRefreshRowsByUser(results),
      (userRows) =>
        Effect.forEach(userRows, (row) =>
          Effect.promise(() =>
            refreshOnePluginServer({ env, database, row, now })
          )
        ),
      { concurrency: PLUGIN_SERVER_MANIFEST_REFRESH_CONCURRENCY_COUNT }
    )
  )
  const refreshResults = refreshResultGroups.flat()
  const refreshed = refreshResults.filter(Boolean).length
  return { refreshed, failed: refreshResults.length - refreshed }
}
