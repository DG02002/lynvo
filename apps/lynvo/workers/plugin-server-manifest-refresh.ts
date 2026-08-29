import {
  HttpPluginServerTransport,
  PluginServerClient,
} from "../app/lib/extraction/plugin-server-client"
import {
  getLynvoManifestExtension,
  type PluginServerManifest,
} from "@dg02002/lynvo-plugin-server-protocol"
import { getRuntime } from "../app/lib/effect/runtime"
import { loadRegisteredPluginServers } from "../app/lib/effect/services/authenticated-extraction-context"
import {
  PLUGIN_SERVER_MANIFEST_REFRESH_BATCH_SIZE,
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

interface RefreshOnePluginServerInput {
  env: Env
  database: D1Database
  userId: string
  pluginServerId: string
  now: number
}

interface LoadRefreshablePluginServerInput {
  runtime: ReturnType<typeof getRuntime>
  env: Env
  userId: string
  pluginServerId: string
}

interface RefreshPluginServerInput {
  env: Env
  database: D1Database
  runtime: ReturnType<typeof getRuntime>
  userId: string
  pluginServer: RefreshablePluginServer
  now: number
}

interface RefreshProxyBalanceInput {
  runtime: ReturnType<typeof getRuntime>
  database: D1Database
  userId: string
  manifest: PluginServerManifest
  pluginServer: RefreshablePluginServer
  now: number
}

const loadRefreshablePluginServer = async ({
  runtime,
  env,
  userId,
  pluginServerId,
}: LoadRefreshablePluginServerInput): Promise<
  RefreshablePluginServer | undefined
> => {
  const context = await runtime.runPromise(
    loadRegisteredPluginServers(env, userId)
  )
  return context.pluginServers.find(
    (candidate) => candidate.id === pluginServerId
  )
}

const refreshPluginServer = async ({
  env,
  database,
  runtime,
  userId,
  pluginServer,
  now,
}: RefreshPluginServerInput): Promise<void> => {
  const client = new PluginServerClient(
    new HttpPluginServerTransport(pluginServer.baseUrl)
  )
  const manifest = await client.getManifest({ apiKey: pluginServer.apiKey })
  await refreshProxyBalanceIfDue({
    runtime,
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
  userId,
  pluginServerId,
  now,
}: RefreshOnePluginServerInput): Promise<boolean> => {
  try {
    const runtime = getRuntime(env)
    const pluginServer = await loadRefreshablePluginServer({
      runtime,
      env,
      userId,
      pluginServerId,
    })
    if (!pluginServer) {
      return false
    }
    await refreshPluginServer({
      env,
      database,
      runtime,
      userId,
      pluginServer,
      now,
    })
    return true
  } catch (error) {
    console.warn("plugin_server_manifest_refresh_failed", {
      operation: "plugin_server_manifest_refresh_failed",
      plugin_server_id: pluginServerId,
      user_id: userId,
      error: error instanceof Error ? error.message : String(error),
    })
    await recordPluginServerVerificationFailure(database, userId, {
      id: pluginServerId,
      now,
    }).catch(() => undefined)
    return false
  }
}

const refreshProxyBalanceIfDue = async ({
  runtime,
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
  const balance = await runtime
    .runPromise(readScrapeDoAccountInfo(pluginServer.proxyToken))
    .catch(() => undefined)
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
      `SELECT id, user_id FROM user_plugin_servers
       WHERE credential_status = 'ready'
         AND (
           last_manifest_refresh_at IS NULL
           OR last_manifest_refresh_at <= ?1
           OR (
             verification_status = 'down'
             AND (last_manifest_refresh_at IS NULL OR last_manifest_refresh_at <= ?2)
           )
         )
       LIMIT ?3`
    )
    .bind(
      now - PLUGIN_SERVER_MANIFEST_REFRESH_INTERVAL_MS,
      now - PLUGIN_SERVER_MANIFEST_REFRESH_RETRY_DOWN_INTERVAL_MS,
      PLUGIN_SERVER_MANIFEST_REFRESH_BATCH_SIZE
    )
    .all<{ id: string; user_id: string }>()
  let refreshed = 0
  let failed = 0
  for (const row of results) {
    const didRefresh = await refreshOnePluginServer({
      env,
      database,
      userId: row.user_id,
      pluginServerId: row.id,
      now,
    })
    if (didRefresh) {
      refreshed += 1
    } else {
      failed += 1
    }
  }
  return { refreshed, failed }
}
