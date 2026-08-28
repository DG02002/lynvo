import {
  HttpPluginServerTransport,
  PluginServerClient,
} from "../app/lib/extraction/plugin-server-client"
import { getRuntime } from "../app/lib/effect/runtime"
import { loadRegisteredPluginServers } from "../app/lib/effect/services/authenticated-extraction-context"
import {
  PLUGIN_SERVER_MANIFEST_REFRESH_BATCH_SIZE,
  PLUGIN_SERVER_MANIFEST_REFRESH_RETRY_DOWN_INTERVAL_MS,
  PLUGIN_SERVER_MANIFEST_REFRESH_INTERVAL_MS,
} from "./constants"
import {
  recordPluginServerRefreshSuccess,
  recordPluginServerVerificationFailure,
} from "./d1/plugin-servers"
import { notifyAccountDataChanged } from "./d1/data-version-notification"

const refreshOnePluginServer = async (
  env: Env,
  database: D1Database,
  userId: string,
  pluginServerId: string,
  now: number
): Promise<boolean> => {
  try {
    const runtime = getRuntime(env)
    const context = await runtime.runPromise(
      loadRegisteredPluginServers(env, userId)
    )
    const pluginServer = context.pluginServers.find(
      (candidate) => candidate.id === pluginServerId
    )
    if (!pluginServer) {
      return false
    }
    const client = new PluginServerClient(
      new HttpPluginServerTransport(pluginServer.baseUrl)
    )
    const manifest = await client.getManifest({ apiKey: pluginServer.apiKey })
    const result = await recordPluginServerRefreshSuccess(database, userId, {
      id: pluginServerId,
      manifest: JSON.stringify(manifest),
      now,
    })
    await notifyAccountDataChanged(env, userId, result.dataVersion).catch(
      () => undefined
    )
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
    const didRefresh = await refreshOnePluginServer(
      env,
      database,
      row.user_id,
      row.id,
      now
    )
    if (didRefresh) {
      refreshed += 1
    } else {
      failed += 1
    }
  }
  return { refreshed, failed }
}
