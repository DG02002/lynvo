import { createOpaqueId } from "./ids"
import {
  DEVICE_CODE_ALPHABET_SIZE,
  DEVICE_CODE_CLEANUP_BATCH_SIZE,
  DEVICE_CODE_COLLISION_ATTEMPTS,
  DEVICE_CODE_EXCHANGE_LEASE_MS,
  DEVICE_CODE_FIRST_LETTER_CODE_POINT,
  DEVICE_CODE_GROUP_LENGTH,
  DEVICE_CODE_LETTER_COUNT,
  DEVICE_CODE_RANDOM_LIMIT,
  DEVICE_CODE_TTL_MS,
  D1_SESSION_TOTAL_DURATION_MS,
} from "../constants"

export interface DeviceCodeRecord {
  code: string
  pollSecretDigest: string
  status: "pending" | "authorized" | "exchanging" | "consumed"
  deviceName: string
  userId: string | null
  exchangeAttemptId: string | null
  exchangeGeneration: number | null
  exchangeLeaseExpiresAt: number | null
  exchangeSessionId: string | null
  consumedSessionId: string | null
  expiresAt: number
  createdAt: number
}

interface DeviceCodeRow {
  code: string
  poll_secret_digest: string
  status: DeviceCodeRecord["status"]
  device_name: string
  user_id: string | null
  exchange_attempt_id: string | null
  exchange_generation: number | null
  exchange_lease_expires_at: number | null
  exchange_session_id: string | null
  consumed_session_id: string | null
  expires_at: number
  created_at: number
}

const mapDeviceCodeRow = (row: DeviceCodeRow): DeviceCodeRecord => ({
  code: row.code,
  pollSecretDigest: row.poll_secret_digest,
  status: row.status,
  deviceName: row.device_name,
  userId: row.user_id,
  exchangeAttemptId: row.exchange_attempt_id,
  exchangeGeneration: row.exchange_generation,
  exchangeLeaseExpiresAt: row.exchange_lease_expires_at,
  exchangeSessionId: row.exchange_session_id,
  consumedSessionId: row.consumed_session_id,
  expiresAt: row.expires_at,
  createdAt: row.created_at,
})

const DEVICE_CODE_COLUMNS =
  "code, poll_secret_digest, status, device_name, user_id, exchange_attempt_id, exchange_generation, exchange_lease_expires_at, exchange_session_id, consumed_session_id, expires_at, created_at"

export const generateDeviceCode = (): string => {
  let letters = ""
  while (letters.length < DEVICE_CODE_LETTER_COUNT) {
    const randomValues = new Uint8Array(DEVICE_CODE_LETTER_COUNT)
    crypto.getRandomValues(randomValues)
    for (const randomValue of randomValues) {
      if (
        randomValue < DEVICE_CODE_RANDOM_LIMIT &&
        letters.length < DEVICE_CODE_LETTER_COUNT
      ) {
        letters += String.fromCharCode(
          DEVICE_CODE_FIRST_LETTER_CODE_POINT +
            (randomValue % DEVICE_CODE_ALPHABET_SIZE)
        )
      }
    }
  }
  return `${letters.slice(0, DEVICE_CODE_GROUP_LENGTH)}-${letters.slice(DEVICE_CODE_GROUP_LENGTH)}`
}

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")

export const digestPollSecret = async (pollSecret: string) =>
  bytesToHex(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(pollSecret)
      )
    )
  )

const generatePollSecret = () => {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}

const findDeviceCodeRecord = async (
  database: D1Database,
  code: string
): Promise<DeviceCodeRecord | null> => {
  const row = await database
    .prepare(`SELECT ${DEVICE_CODE_COLUMNS} FROM device_codes WHERE code = ?1`)
    .bind(code)
    .first<DeviceCodeRow>()
  return row ? mapDeviceCodeRow(row) : null
}

export interface CreatedDeviceCode {
  readonly code: string
  readonly pollSecret: string
  readonly expiresAt: number
  readonly deviceName: string
}

export const createDeviceCode = async (
  database: D1Database,
  input: { readonly deviceName: string; readonly now: number }
): Promise<CreatedDeviceCode> => {
  const deviceName = input.deviceName.trim().slice(0, 80) || "Unknown device"
  const candidates = Array.from(
    { length: DEVICE_CODE_COLLISION_ATTEMPTS },
    (_, priority) => ({ code: generateDeviceCode(), priority })
  )
  const candidateValuesSql = candidates
    .map((_, priority) => `(?${priority + 1}, ${priority})`)
    .join(", ")
  const pollSecret = generatePollSecret()
  const pollSecretDigest = await digestPollSecret(pollSecret)
  const expiresAt = input.now + DEVICE_CODE_TTL_MS
  const valueParameterOffset = candidates.length
  const inserted = await database
    .prepare(
      `WITH candidates(code, priority) AS (VALUES ${candidateValuesSql})
       INSERT INTO device_codes (code, poll_secret_digest, status, device_name, expires_at, created_at)
       SELECT candidates.code, ?${valueParameterOffset + 1}, 'pending', ?${valueParameterOffset + 2}, ?${valueParameterOffset + 3}, ?${valueParameterOffset + 4}
       FROM candidates
       WHERE NOT EXISTS (SELECT 1 FROM device_codes WHERE device_codes.code = candidates.code)
       ORDER BY candidates.priority
       LIMIT 1
       ON CONFLICT(code) DO NOTHING
       RETURNING code`
    )
    .bind(
      ...candidates.map((candidate) => candidate.code),
      pollSecretDigest,
      deviceName,
      expiresAt,
      input.now
    )
    .first<{ code: string }>()
  if (!inserted) {
    throw new Error("Unable to allocate a device code")
  }
  return { code: inserted.code, pollSecret, expiresAt, deviceName }
}

export type DeviceCodeStatusOutcome =
  | { kind: "invalid" }
  | {
      kind: "known"
      status: "pending" | "authorized" | "consumed"
      deviceName: string
      expiresAt: number
    }

export const getDeviceCodeStatus = async (
  database: D1Database,
  input: { readonly code: string; readonly pollSecret: string }
): Promise<DeviceCodeStatusOutcome> => {
  const record = await findDeviceCodeRecord(database, input.code)
  if (
    !record ||
    record.pollSecretDigest !== (await digestPollSecret(input.pollSecret))
  ) {
    return { kind: "invalid" }
  }
  return {
    kind: "known",
    status: record.status === "exchanging" ? "authorized" : record.status,
    deviceName: record.deviceName,
    expiresAt: record.expiresAt,
  }
}

export const getDeviceCodeForApproval = async (
  database: D1Database,
  code: string
): Promise<{
  code: string
  status: DeviceCodeRecord["status"]
  deviceName: string
  expiresAt: number
} | null> => {
  const record = await findDeviceCodeRecord(database, code)
  if (!record) {
    return null
  }
  return {
    code: record.code,
    status: record.status,
    deviceName: record.deviceName,
    expiresAt: record.expiresAt,
  }
}

export type AuthorizeOutcome =
  | { kind: "authorized" }
  | { kind: "unknownCode" }
  | { kind: "usedOrExpired" }

export const authorizeDeviceCode = async (
  database: D1Database,
  input: {
    readonly code: string
    readonly userId: string
    readonly now: number
  }
): Promise<AuthorizeOutcome> => {
  const result = await database
    .prepare(
      "UPDATE device_codes SET status = 'authorized', user_id = ?2 WHERE code = ?1 AND status = 'pending' AND expires_at > ?3"
    )
    .bind(input.code, input.userId, input.now)
    .run()
  if ((result.meta.changes ?? 0) === 0) {
    const record = await findDeviceCodeRecord(database, input.code)
    return record ? { kind: "usedOrExpired" } : { kind: "unknownCode" }
  }
  return { kind: "authorized" }
}

export type ClaimOutcome =
  | {
      kind: "claimed"
      userId: string
      deviceName: string
      sessionId: string
    }
  | { kind: "notApproved" }
  | { kind: "invalidExchangeSession" }

const isClaimEligibleStatus = (
  record: DeviceCodeRecord,
  attemptId: string,
  now: number
): boolean =>
  record.status === "authorized" ||
  (record.status === "exchanging" &&
    (record.exchangeAttemptId === attemptId ||
      (record.exchangeLeaseExpiresAt !== null &&
        record.exchangeLeaseExpiresAt <= now)))

interface ResumeClaimedExchangeSessionInput {
  database: D1Database
  record: DeviceCodeRecord
  userId: string
  input: {
    readonly code: string
    readonly attemptId: string
    readonly now: number
  }
}

const resumeClaimedExchangeSession = async ({
  database,
  record,
  userId,
  input,
}: ResumeClaimedExchangeSessionInput): Promise<ClaimOutcome | undefined> => {
  const isSameActiveAttempt =
    record.status === "exchanging" &&
    record.exchangeAttemptId === input.attemptId
  if (!isSameActiveAttempt || !record.exchangeSessionId) {
    return undefined
  }
  const existingSession = await database
    .prepare("SELECT id, user_id, revoked_at FROM sessions WHERE id = ?1")
    .bind(record.exchangeSessionId)
    .first<{ id: string; user_id: string; revoked_at: number | null }>()
  if (
    !existingSession ||
    existingSession.user_id !== userId ||
    existingSession.revoked_at !== null
  ) {
    return { kind: "invalidExchangeSession" }
  }
  const refreshed = await database
    .prepare(
      "UPDATE device_codes SET exchange_lease_expires_at = ?3 WHERE code = ?1 AND exchange_attempt_id = ?2"
    )
    .bind(
      input.code,
      input.attemptId,
      input.now + DEVICE_CODE_EXCHANGE_LEASE_MS
    )
    .run()
  if ((refreshed.meta.changes ?? 0) === 0) {
    return { kind: "notApproved" }
  }
  return {
    kind: "claimed",
    userId,
    deviceName: record.deviceName,
    sessionId: existingSession.id,
  }
}

export const claimAuthorizedCode = async (
  database: D1Database,
  input: {
    readonly code: string
    readonly pollSecret: string
    readonly attemptId: string
    readonly generation: number
    readonly now: number
  }
): Promise<ClaimOutcome> => {
  const [record, pollSecretDigest] = await Promise.all([
    findDeviceCodeRecord(database, input.code),
    digestPollSecret(input.pollSecret),
  ])
  const isStaleGeneration =
    record?.exchangeAttemptId === input.attemptId &&
    record.exchangeGeneration !== null &&
    input.generation <= record.exchangeGeneration
  if (
    !record ||
    !isClaimEligibleStatus(record, input.attemptId, input.now) ||
    !record.userId ||
    isStaleGeneration ||
    input.now >= record.expiresAt ||
    record.pollSecretDigest !== pollSecretDigest
  ) {
    return { kind: "notApproved" }
  }

  const resumedOutcome = await resumeClaimedExchangeSession({
    database,
    record,
    userId: record.userId,
    input,
  })
  if (resumedOutcome) {
    return resumedOutcome
  }

  if (
    record.status === "exchanging" &&
    record.exchangeAttemptId &&
    record.exchangeSessionId
  ) {
    const supersededSession = await database
      .prepare("SELECT user_id FROM sessions WHERE id = ?1")
      .bind(record.exchangeSessionId)
      .first<{ user_id: string }>()
    if (supersededSession && supersededSession.user_id === record.userId) {
      await database
        .prepare(
          "UPDATE sessions SET revoked_at = ?2 WHERE id = ?1 AND revoked_at IS NULL"
        )
        .bind(record.exchangeSessionId, input.now)
        .run()
    }
  }

  const mintedSessionId = createOpaqueId()
  const [_insertResult, updateResult] = await database.batch([
    database
      .prepare(
        "INSERT INTO sessions (id, user_id, created_at, last_seen_at, expires_at, revoked_at, user_agent) VALUES (?1, ?2, ?3, ?3, ?4, NULL, NULL)"
      )
      .bind(
        mintedSessionId,
        record.userId,
        input.now,
        input.now + D1_SESSION_TOTAL_DURATION_MS
      ),
    database
      .prepare(
        "UPDATE device_codes SET status = 'exchanging', exchange_attempt_id = ?2, exchange_generation = ?3, exchange_lease_expires_at = ?4, exchange_session_id = ?5 WHERE code = ?1 AND poll_secret_digest = ?6 AND (status = 'authorized' OR (status = 'exchanging' AND (exchange_attempt_id = ?2 OR (exchange_lease_expires_at IS NOT NULL AND exchange_lease_expires_at <= ?7)))) AND user_id IS NOT NULL AND expires_at > ?7 AND (exchange_attempt_id != ?2 OR exchange_generation IS NULL OR exchange_generation < ?3) AND exchange_session_id IS ?8"
      )
      .bind(
        input.code,
        input.attemptId,
        input.generation,
        input.now + DEVICE_CODE_EXCHANGE_LEASE_MS,
        mintedSessionId,
        pollSecretDigest,
        input.now,
        record.exchangeSessionId
      ),
  ])
  if ((updateResult?.meta.changes ?? 0) === 0) {
    await database
      .prepare("DELETE FROM sessions WHERE id = ?1")
      .bind(mintedSessionId)
      .run()
    return { kind: "notApproved" }
  }
  return {
    kind: "claimed",
    userId: record.userId,
    deviceName: record.deviceName,
    sessionId: mintedSessionId,
  }
}

export type FinalizeOutcome =
  | { kind: "finalized" }
  | { kind: "alreadyFinalized" }
  | { kind: "superseded" }

export const finalizeDeviceExchange = async (
  database: D1Database,
  input: {
    readonly code: string
    readonly pollSecret: string
    readonly attemptId: string
    readonly sessionId: string
    readonly generation: number
  }
): Promise<FinalizeOutcome> => {
  const record = await findDeviceCodeRecord(database, input.code)
  if (
    !record ||
    record.pollSecretDigest !== (await digestPollSecret(input.pollSecret)) ||
    record.exchangeAttemptId !== input.attemptId ||
    record.exchangeGeneration !== input.generation ||
    record.exchangeSessionId !== input.sessionId
  ) {
    return { kind: "superseded" }
  }
  if (
    record.status === "consumed" &&
    record.consumedSessionId === input.sessionId
  ) {
    return { kind: "alreadyFinalized" }
  }
  if (record.status !== "exchanging") {
    return { kind: "superseded" }
  }
  const result = await database
    .prepare(
      "UPDATE device_codes SET status = 'consumed', consumed_session_id = ?2, exchange_lease_expires_at = NULL WHERE code = ?1 AND status = 'exchanging' AND exchange_attempt_id = ?3 AND exchange_generation = ?4 AND exchange_session_id = ?5"
    )
    .bind(
      input.code,
      input.sessionId,
      input.attemptId,
      input.generation,
      input.sessionId
    )
    .run()
  return (result.meta.changes ?? 0) > 0
    ? { kind: "finalized" }
    : { kind: "superseded" }
}

export type RecoverOutcome =
  | "resumable"
  | "completed"
  | "superseded"
  | "invalid"

export const recoverDeviceExchange = async (
  database: D1Database,
  input: {
    readonly userId: string
    readonly sessionId: string
    readonly code: string
    readonly pollSecret: string
    readonly attemptId: string
  }
): Promise<RecoverOutcome> => {
  const record = await findDeviceCodeRecord(database, input.code)
  if (
    !record ||
    record.userId !== input.userId ||
    record.exchangeSessionId !== input.sessionId ||
    record.pollSecretDigest !== (await digestPollSecret(input.pollSecret))
  ) {
    return "invalid"
  }
  if (record.exchangeAttemptId !== input.attemptId) {
    return "superseded"
  }
  if (
    record.status === "consumed" &&
    record.consumedSessionId === input.sessionId
  ) {
    return "completed"
  }
  if (record.status === "exchanging") {
    return "resumable"
  }
  return "invalid"
}

export type AbortOutcome = { kind: "aborted" } | { kind: "invalidSession" }

export const abortDeviceExchange = async (
  database: D1Database,
  input: {
    readonly userId: string
    readonly sessionId: string
    readonly code: string
    readonly attemptId: string
    readonly generation: number
    readonly now: number
  }
): Promise<AbortOutcome> => {
  const session = await database
    .prepare("SELECT user_id FROM sessions WHERE id = ?1")
    .bind(input.sessionId)
    .first<{ user_id: string }>()
  if (!session || session.user_id !== input.userId) {
    return { kind: "invalidSession" }
  }
  const record = await findDeviceCodeRecord(database, input.code)
  const recordMatchesAttempt =
    record?.userId === input.userId &&
    record.exchangeAttemptId === input.attemptId &&
    record.exchangeSessionId === input.sessionId
  if (recordMatchesAttempt && record.exchangeGeneration !== input.generation) {
    return { kind: "aborted" }
  }
  if (recordMatchesAttempt) {
    await database
      .prepare(
        "UPDATE device_codes SET status = 'authorized', exchange_lease_expires_at = NULL, exchange_session_id = NULL, consumed_session_id = NULL WHERE code = ?1"
      )
      .bind(input.code)
      .run()
  }
  await database
    .prepare(
      "UPDATE sessions SET revoked_at = ?2 WHERE id = ?1 AND revoked_at IS NULL"
    )
    .bind(input.sessionId, input.now)
    .run()
  return { kind: "aborted" }
}

export const cleanupExpiredDeviceCodes = async (
  database: D1Database,
  now: number
): Promise<{ deleted: number }> => {
  const expired = await database
    .prepare(
      `SELECT ${DEVICE_CODE_COLUMNS} FROM device_codes WHERE expires_at < ?1 LIMIT ?2`
    )
    .bind(now, DEVICE_CODE_CLEANUP_BATCH_SIZE)
    .all<DeviceCodeRow>()
  const records = expired.results.map(mapDeviceCodeRow)
  const statements: D1PreparedStatement[] = []
  for (const record of records) {
    if (record.status !== "consumed" && record.exchangeSessionId) {
      statements.push(
        database
          .prepare(
            "UPDATE sessions SET revoked_at = ?2 WHERE id = ?1 AND revoked_at IS NULL"
          )
          .bind(record.exchangeSessionId, now)
      )
    }
  }
  if (records.length > 0) {
    const placeholders = records.map((_, index) => `?${index + 1}`).join(", ")
    statements.push(
      database
        .prepare(`DELETE FROM device_codes WHERE code IN (${placeholders})`)
        .bind(...records.map((record) => record.code))
    )
  }
  if (statements.length > 0) {
    await database.batch(statements)
  }
  return { deleted: records.length }
}
