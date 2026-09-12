import { SAVED_LINK_COMMAND_OPERATION_TTL_MS } from "../constants"
import type { OwnedWriteGuard } from "./data-version"
import { LinkNotFoundError } from "./errors"
import type { LinkRow } from "./rows"
import {
  SAVED_LINK_META_APPLIED_OPERATION_LINK_SQL,
  type SavedLinkMetaAppliedLink,
} from "./saved-link-meta-applied"

const SAVED_LINK_OPERATION_RESERVED_STATE = "reserved"
const SAVED_LINK_OPERATION_COMPLETED_STATE = "completed"
const SAVED_LINK_DELETE_CLAIMED_COMMAND = "delete:claimed"
const RESERVED_SAVED_LINK_OPERATION_STATE = `state = '${SAVED_LINK_OPERATION_RESERVED_STATE}'`
const RESERVED_SAVED_LINK_OPERATION_CONDITION = `${RESERVED_SAVED_LINK_OPERATION_STATE} AND link_id IS NULL`
const NO_SAVED_LINKS_CONDITION =
  "NOT EXISTS (SELECT 1 FROM links WHERE user_id = ?1)"

export const SAVED_LINK_COLUMNS =
  "id, user_id, url, title, meta_json, opened_at, created_at, updated_at, expires_at, extraction_state, extraction_error, extraction_attempts, extraction_available_at, extraction_lease_expires_at"

export interface CompletedSavedLinkOperation {
  linkId: string | null
}

export interface SavedLinkCommandOperationKey {
  userId: string
  operationId: string
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
      `SELECT link_id FROM link_command_operations WHERE user_id = ?1 AND operation_id = ?2 AND state = '${SAVED_LINK_OPERATION_COMPLETED_STATE}'`
    )
    .bind(userId, operationId)
    .first<{ link_id: string | null }>()
  return row ? { linkId: row.link_id } : null
}

export const reserveSavedLinkCommandOperation = async (
  database: D1Database,
  input: SavedLinkCommandOperationKey & {
    command: string
    now: number
  }
): Promise<boolean> => {
  const results = await database.batch([
    database
      .prepare(
        `INSERT INTO link_command_operations (user_id, operation_id, link_id, state, command, created_at, expires_at) VALUES (?1, ?2, NULL, '${SAVED_LINK_OPERATION_RESERVED_STATE}', ?3, ?4, ?5) ON CONFLICT(user_id, operation_id) DO NOTHING`
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
  input: SavedLinkCommandOperationKey & {
    linkId: string
    appliedLink?: SavedLinkMetaAppliedLink
  }
): D1PreparedStatement => {
  const baseSql = `UPDATE link_command_operations SET link_id = ?3, state = '${SAVED_LINK_OPERATION_COMPLETED_STATE}' WHERE user_id = ?1 AND operation_id = ?2 AND ${RESERVED_SAVED_LINK_OPERATION_CONDITION}`
  return database
    .prepare(
      input.appliedLink
        ? `${baseSql} AND EXISTS (${SAVED_LINK_META_APPLIED_OPERATION_LINK_SQL})`
        : baseSql
    )
    .bind(
      input.userId,
      input.operationId,
      input.linkId,
      ...(input.appliedLink
        ? [input.appliedLink.metaJson, input.appliedLink.updatedAt]
        : [])
    )
}

export const createSavedLinkDeleteClaimStatement = (
  database: D1Database,
  input: SavedLinkCommandOperationKey & { linkId: string }
): D1PreparedStatement =>
  database
    .prepare(
      `UPDATE link_command_operations
       SET link_id = ?3, command = '${SAVED_LINK_DELETE_CLAIMED_COMMAND}'
       WHERE user_id = ?1
         AND operation_id = ?2
         AND ${RESERVED_SAVED_LINK_OPERATION_CONDITION}
         AND EXISTS (
           SELECT 1 FROM links WHERE id = ?3 AND user_id = ?1
         )`
    )
    .bind(input.userId, input.operationId, input.linkId)

export const createSavedLinkDeleteCompletionStatement = (
  database: D1Database,
  input: SavedLinkCommandOperationKey & { linkId: string }
): D1PreparedStatement =>
  database
    .prepare(
      `UPDATE link_command_operations
       SET link_id = NULL, state = '${SAVED_LINK_OPERATION_COMPLETED_STATE}'
       WHERE user_id = ?1
         AND operation_id = ?2
         AND ${RESERVED_SAVED_LINK_OPERATION_STATE}
         AND command = '${SAVED_LINK_DELETE_CLAIMED_COMMAND}'
         AND (link_id = ?3 OR link_id IS NULL)
         AND NOT EXISTS (SELECT 1 FROM links WHERE id = ?3)`
    )
    .bind(input.userId, input.operationId, input.linkId)

export const createSavedLinkDeleteLedgerCondition = (
  input: SavedLinkCommandOperationKey & { linkId: string }
): OwnedWriteGuard => ({
  conditionSql: `SELECT 1 FROM link_command_operations WHERE user_id = ?1 AND operation_id = ?6 AND command = '${SAVED_LINK_DELETE_CLAIMED_COMMAND}' AND link_id = ?7`,
  conditionBindings: [input.operationId, input.linkId],
})

export const createSavedLinkDeleteGuard = (
  input: SavedLinkCommandOperationKey & { linkId: string }
): OwnedWriteGuard => ({
  conditionSql: `SELECT 1 FROM link_command_operations WHERE user_id = ?1 AND operation_id = ?2 AND state = '${SAVED_LINK_OPERATION_COMPLETED_STATE}' AND command = '${SAVED_LINK_DELETE_CLAIMED_COMMAND}' AND link_id IS NULL AND NOT EXISTS (SELECT 1 FROM links WHERE id = ?3)`,
  conditionBindings: [input.operationId, input.linkId],
})

export const createSavedLinkOperationCompletionStatement = (
  database: D1Database,
  input: SavedLinkCommandOperationKey & {
    requireNoSavedLinks?: boolean
    condition?: OwnedWriteGuard
  }
): D1PreparedStatement => {
  const noSavedLinksCondition = input.requireNoSavedLinks
    ? ` AND ${NO_SAVED_LINKS_CONDITION}`
    : ""
  const condition = input.condition
    ? ` AND ${input.condition.conditionSql}`
    : ""
  return database
    .prepare(
      `UPDATE link_command_operations SET state = '${SAVED_LINK_OPERATION_COMPLETED_STATE}' WHERE user_id = ?1 AND operation_id = ?2 AND ${RESERVED_SAVED_LINK_OPERATION_CONDITION}${noSavedLinksCondition}${condition}`
    )
    .bind(
      input.userId,
      input.operationId,
      ...(input.condition?.conditionBindings ?? [])
    )
}

export const completeSavedLinkOperationIfNoSavedLinks = async (
  database: D1Database,
  input: SavedLinkCommandOperationKey
): Promise<boolean> => {
  // This is ledger-only state; keeping it out of executeOwnedWrite preserves
  // the data_version for a clear that changes no Saved links.
  const results = await database.batch([
    createSavedLinkOperationCompletionStatement(database, {
      ...input,
      requireNoSavedLinks: true,
    }),
  ])
  return (results[0]?.meta.changes ?? 0) > 0
}

export const releaseReservedSavedLinkCommandOperation = async (
  database: D1Database,
  input: SavedLinkCommandOperationKey
): Promise<void> => {
  await database
    .prepare(
      `DELETE FROM link_command_operations WHERE user_id = ?1 AND operation_id = ?2 AND ${RESERVED_SAVED_LINK_OPERATION_STATE}`
    )
    .bind(input.userId, input.operationId)
    .run()
}

export const createConditionalSavedLinkCommandOperationStatement = (
  database: D1Database,
  input: SavedLinkCommandOperationKey & {
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
      `INSERT INTO link_command_operations (user_id, operation_id, link_id, state, command, created_at, expires_at)
       SELECT ?1, ?2, ?3, '${SAVED_LINK_OPERATION_COMPLETED_STATE}', ?4, ?5, ?6
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
    throw new LinkNotFoundError()
  }
  return existing
}
