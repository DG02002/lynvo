import {
  REMOTE_COMMAND_CLEANUP_BATCH_SIZE,
  REMOTE_COMMAND_CLAIM_LEASE_MS,
  REMOTE_COMMAND_MAX_PAYLOAD_BYTES,
  REMOTE_COMMAND_NOTIFICATION_BATCH_SIZE,
  REMOTE_COMMAND_QUERY_LIMIT,
  REMOTE_COMMAND_TTL_MS,
} from "../constants"
import { executeOwnedWrite } from "./data-version"
import { createOpaqueId } from "./ids"

interface RemoteCommandRow {
  id: string
  user_id: string
  target_session_id: string
  target_receiver_id: string
  command: "play"
  payload: string
  created_at: number
  expires_at: number
  status: "queued" | "claimed" | "applied" | "failed"
  available_at: number | null
  notification_pending: number | null
  claim_token: string | null
  claim_expires_at: number | null
  result_message: string | null
}

const assertPayloadSize = (payload: string): void => {
  if (
    new TextEncoder().encode(payload).byteLength >
    REMOTE_COMMAND_MAX_PAYLOAD_BYTES
  ) {
    throw new Error("Remote command payload is too large")
  }
}

const requireOwnedTargetSession = async (
  database: D1Database,
  userId: string,
  targetSessionId: string,
  now: number
): Promise<void> => {
  const session = await database
    .prepare(
      "SELECT user_id FROM sessions WHERE id = ?1 AND revoked_at IS NULL AND expires_at > ?2"
    )
    .bind(targetSessionId, now)
    .first<{ user_id: string }>()
  if (!session || session.user_id !== userId) {
    throw new Error("Remote session not found")
  }
}

export const enqueueRemoteCommand = async (
  database: D1Database,
  userId: string,
  input: {
    targetSessionId: string
    command: "play"
    payload: string
    targetReceiverId: string
    now: number
  }
): Promise<{ id: string; dataVersion: number }> => {
  assertPayloadSize(input.payload)
  await requireOwnedTargetSession(
    database,
    userId,
    input.targetSessionId,
    input.now
  )
  const commandId = createOpaqueId()
  const { dataVersion } = await executeOwnedWrite(database, userId, [
    database
      .prepare(
        "INSERT INTO remote_commands (id, user_id, target_session_id, target_receiver_id, command, payload, created_at, expires_at, status, available_at, notification_pending, claim_token, claim_expires_at, result_message) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'queued', ?7, 1, NULL, NULL, NULL)"
      )
      .bind(
        commandId,
        userId,
        input.targetSessionId,
        input.targetReceiverId,
        input.command,
        input.payload,
        input.now,
        input.now + REMOTE_COMMAND_TTL_MS
      ),
  ])
  return { id: commandId, dataVersion }
}

interface ClaimableCommandRow {
  id: string
  status: "queued" | "claimed"
  command: "play"
  payload: string
  created_at: number
}

const findClaimableCommand = async (
  database: D1Database,
  userId: string,
  sessionId: string,
  receiverId: string,
  status: "queued" | "claimed",
  now: number
): Promise<ClaimableCommandRow | null> => {
  const row = await database
    .prepare(
      `SELECT id, status, command, payload, created_at FROM remote_commands WHERE user_id = ?1 AND target_session_id = ?2 AND target_receiver_id = ?3 AND status = ?4 AND available_at <= ?5 AND expires_at > ?5 ORDER BY created_at ASC LIMIT ?6`
    )
    .bind(
      userId,
      sessionId,
      receiverId,
      status,
      now,
      REMOTE_COMMAND_QUERY_LIMIT
    )
    .first<ClaimableCommandRow>()
  return row ?? null
}

export interface RemoteCommandClaim {
  id: string
  command: "play"
  payload: string
  createdAt: number
  claimToken: string
  dataVersion: number
}

export const claimNextRemoteCommand = async (
  database: D1Database,
  userId: string,
  sessionId: string,
  input: { receiverId: string; now: number }
): Promise<RemoteCommandClaim | null> => {
  const [queuedCommand, reclaimableCommand] = await Promise.all([
    findClaimableCommand(
      database,
      userId,
      sessionId,
      input.receiverId,
      "queued",
      input.now
    ),
    findClaimableCommand(
      database,
      userId,
      sessionId,
      input.receiverId,
      "claimed",
      input.now
    ),
  ])
  const command =
    queuedCommand && reclaimableCommand
      ? queuedCommand.created_at <= reclaimableCommand.created_at
        ? queuedCommand
        : reclaimableCommand
      : (queuedCommand ?? reclaimableCommand)
  if (!command) {
    return null
  }
  const claimToken = crypto.randomUUID()
  const leaseExpiresAt = input.now + REMOTE_COMMAND_CLAIM_LEASE_MS
  const { dataVersion, statementResults } = await executeOwnedWrite(
    database,
    userId,
    [
      database
        .prepare(
          "UPDATE remote_commands SET status = 'claimed', claim_token = ?2, claim_expires_at = ?3, available_at = ?3 WHERE id = ?1 AND status = ?4 AND available_at <= ?5 AND expires_at > ?5 AND (claim_token IS NULL OR claim_expires_at <= ?5)"
        )
        .bind(
          command.id,
          claimToken,
          leaseExpiresAt,
          command.status,
          input.now
        ),
    ],
    {
      conditionSql:
        "SELECT 1 FROM remote_commands WHERE id = ?2 AND status = 'claimed' AND claim_token = ?3",
      conditionBindings: [command.id, claimToken],
    }
  )
  const claimResult = statementResults[0]
  if ((claimResult?.meta.changes ?? 0) === 0) {
    return null
  }
  return {
    id: command.id,
    command: command.command,
    payload: command.payload,
    createdAt: command.created_at,
    claimToken,
    dataVersion,
  }
}

export const reportRemoteCommandResult = async (
  database: D1Database,
  userId: string,
  sessionId: string,
  input: {
    id: string
    receiverId: string
    claimToken: string
    result: "applied" | "failed"
    message?: string | undefined
    now: number
  }
): Promise<{ success: boolean; dataVersion: number }> => {
  const row = await database
    .prepare(
      "SELECT id, user_id, target_session_id, target_receiver_id, command, payload, created_at, expires_at, status, available_at, notification_pending, claim_token, claim_expires_at, result_message FROM remote_commands WHERE id = ?1"
    )
    .bind(input.id)
    .first<RemoteCommandRow>()
  if (
    !row ||
    row.user_id !== userId ||
    row.target_session_id !== sessionId ||
    row.target_receiver_id !== input.receiverId ||
    row.claim_token !== input.claimToken
  ) {
    throw new Error("Remote command claim is no longer active")
  }
  if (row.status === input.result) {
    return {
      success: true,
      dataVersion: await executeOwnedWrite(database, userId, []).then(
        (result) => result.dataVersion
      ),
    }
  }
  if (row.status !== "claimed") {
    throw new Error("Remote command claim is no longer active")
  }
  const { dataVersion } = await executeOwnedWrite(database, userId, [
    database
      .prepare(
        "UPDATE remote_commands SET status = ?2, result_message = ?3, claim_expires_at = NULL, available_at = NULL WHERE id = ?1"
      )
      .bind(row.id, input.result, input.message ?? null),
  ])
  return { success: true, dataVersion }
}

export const cleanupExpiredRemoteCommands = async (
  database: D1Database,
  now: number
): Promise<{ deletedCount: number }> => {
  const result = await database
    .prepare(
      "DELETE FROM remote_commands WHERE id IN (SELECT id FROM remote_commands WHERE expires_at < ?1 LIMIT ?2)"
    )
    .bind(now, REMOTE_COMMAND_CLEANUP_BATCH_SIZE)
    .run()
  return { deletedCount: result.meta.changes ?? 0 }
}

export interface PendingRemoteCommandNotification {
  commandId: string
  userId: string
  receiverId: string
}

export const listPendingRemoteCommandNotifications = async (
  database: D1Database
): Promise<PendingRemoteCommandNotification[]> => {
  const { results } = await database
    .prepare(
      "SELECT id, user_id, target_receiver_id FROM remote_commands WHERE notification_pending = 1 ORDER BY created_at ASC LIMIT ?1"
    )
    .bind(REMOTE_COMMAND_NOTIFICATION_BATCH_SIZE)
    .all<{
      id: string
      user_id: string
      target_receiver_id: string
    }>()
  return results.map((row) => ({
    commandId: row.id,
    userId: row.user_id,
    receiverId: row.target_receiver_id,
  }))
}

export const acknowledgeRemoteCommandNotification = async (
  database: D1Database,
  commandId: string
): Promise<{ success: boolean }> => {
  await database
    .prepare(
      "UPDATE remote_commands SET notification_pending = 0 WHERE id = ?1 AND notification_pending = 1"
    )
    .bind(commandId)
    .run()
  return { success: true }
}
