import { SAVED_LINK_COMMAND_OPERATION_TTL_MS } from "../constants"
import type { LinkRow } from "./rows"

export const SAVED_LINK_COLUMNS =
  "id, user_id, url, title, meta_json, opened_at, created_at, updated_at, expires_at, extraction_state, extraction_error, extraction_attempts, extraction_available_at, extraction_lease_expires_at"

export interface CompletedSavedLinkOperation {
  linkId: string | null
}

export const findSavedLinkById = async (
  database: D1Database,
  linkId: string
): Promise<LinkRow | null> => {
  const row = await database
    .prepare(`SELECT ${SAVED_LINK_COLUMNS} FROM links WHERE id = ?1`)
    .bind(linkId)
    .first<LinkRow>()
  return row ?? null
}

export const findCompletedSavedLinkOperation = async (
  database: D1Database,
  userId: string,
  operationId: string
): Promise<CompletedSavedLinkOperation | null> => {
  const row = await database
    .prepare(
      "SELECT link_id FROM link_command_operations WHERE user_id = ?1 AND operation_id = ?2"
    )
    .bind(userId, operationId)
    .first<{ link_id: string | null }>()
  return row ? { linkId: row.link_id } : null
}

export const reserveSavedLinkCommandOperation = async (
  database: D1Database,
  input: {
    userId: string
    operationId: string
    command: string
    now: number
  }
): Promise<boolean> => {
  const results = await database.batch([
    database
      .prepare(
        "INSERT INTO link_command_operations (user_id, operation_id, link_id, command, created_at, expires_at) VALUES (?1, ?2, NULL, ?3, ?4, ?5) ON CONFLICT(user_id, operation_id) DO NOTHING"
      )
      .bind(
        input.userId,
        input.operationId,
        input.command,
        input.now,
        input.now + SAVED_LINK_COMMAND_OPERATION_TTL_MS
      ),
  ])
  return (results[0]?.meta.changes ?? 0) > 0
}

export const createReservedSavedLinkOperationLinkStatement = (
  database: D1Database,
  input: { userId: string; operationId: string; linkId: string }
): D1PreparedStatement =>
  database
    .prepare(
      "UPDATE link_command_operations SET link_id = ?3 WHERE user_id = ?1 AND operation_id = ?2 AND link_id IS NULL"
    )
    .bind(input.userId, input.operationId, input.linkId)

export const releaseReservedSavedLinkCommandOperation = async (
  database: D1Database,
  input: { userId: string; operationId: string }
): Promise<void> => {
  await database
    .prepare(
      "DELETE FROM link_command_operations WHERE user_id = ?1 AND operation_id = ?2 AND link_id IS NULL"
    )
    .bind(input.userId, input.operationId)
    .run()
}

export const createConditionalSavedLinkCommandOperationStatement = (
  database: D1Database,
  input: {
    userId: string
    operationId: string
    linkId: string
    command: string
    now: number
    extractionState: LinkRow["extraction_state"]
    extractionAttempts: number
    leaseExpiresAt: number | null
  }
): D1PreparedStatement =>
  database
    .prepare(
      `INSERT INTO link_command_operations (user_id, operation_id, link_id, command, created_at, expires_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6
       WHERE EXISTS (
         SELECT 1 FROM links
         WHERE id = ?3
           AND user_id = ?1
           AND extraction_state = ?7
           AND extraction_attempts = ?8
           AND ((?9 IS NULL AND extraction_lease_expires_at IS NULL) OR extraction_lease_expires_at = ?9)
       )`
    )
    .bind(
      input.userId,
      input.operationId,
      input.linkId,
      input.command,
      input.now,
      input.now + SAVED_LINK_COMMAND_OPERATION_TTL_MS,
      input.extractionState,
      input.extractionAttempts,
      input.leaseExpiresAt
    )

export const requireOwnedSavedLink = async (
  database: D1Database,
  userId: string,
  linkId: string
): Promise<LinkRow> => {
  const existing = await findSavedLinkById(database, linkId)
  if (!existing || existing.user_id !== userId) {
    throw new Error("Link not found or no longer available")
  }
  return existing
}
