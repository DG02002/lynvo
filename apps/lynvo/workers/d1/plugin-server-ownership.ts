import { PLUGIN_SERVER_COLUMNS, type PluginServerRow } from "./rows"
import { PluginServerUnavailableError } from "./errors"
import { findOwnedRow, requireOwnedRow } from "./owned-row"

export const PLUGIN_SERVER_SELECT = `SELECT ${PLUGIN_SERVER_COLUMNS} FROM user_plugin_servers`

export const findOwnedPluginServerRow = async (
  database: D1Database,
  userId: string,
  pluginServerId: string
): Promise<PluginServerRow | null> => {
  return findOwnedRow({
    database,
    source: { table: "user_plugin_servers", columns: PLUGIN_SERVER_COLUMNS },
    id: pluginServerId,
    userId,
  })
}

export const requireOwnedPluginServerRow = async (
  database: D1Database,
  userId: string,
  pluginServerId: string
): Promise<PluginServerRow> => {
  return requireOwnedRow({
    database,
    source: { table: "user_plugin_servers", columns: PLUGIN_SERVER_COLUMNS },
    id: pluginServerId,
    userId,
    createError: () => new PluginServerUnavailableError(),
  })
}

export const requireReadyPluginServerRow = async (
  database: D1Database,
  userId: string,
  pluginServerId: string
): Promise<PluginServerRow> => {
  const existing = await requireOwnedPluginServerRow(
    database,
    userId,
    pluginServerId
  )
  if (existing.credential_status !== "ready") {
    throw new PluginServerUnavailableError()
  }
  return existing
}
