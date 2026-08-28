import { createOpaqueId } from "./ids"
import { getCookieValue } from "../../app/lib/auth-cookie"
import {
  AUTH_ACTIVITY_TOUCH_INTERVAL_MS,
  D1_SESSION_COOKIE_MAX_AGE_SECONDS,
  D1_SESSION_COOKIE_NAME,
  D1_SESSION_TOTAL_DURATION_MS,
  SESSION_DEVICE_NAME_MAX_LENGTH,
  SESSION_SWEEP_BATCH_SIZE,
} from "../constants"

export interface SessionRecord {
  id: string
  userId: string
  generation: number
  createdAt: number
  lastSeenAt: number
  expiresAt: number
  revokedAt: number | null
  userAgent: string | null
  deviceName: string | null
}

interface SessionRow {
  id: string
  user_id: string
  generation: number
  created_at: number
  last_seen_at: number
  expires_at: number
  revoked_at: number | null
  user_agent: string | null
  device_name: string | null
}

const mapSessionRow = (row: SessionRow): SessionRecord => ({
  id: row.id,
  userId: row.user_id,
  generation: row.generation,
  createdAt: row.created_at,
  lastSeenAt: row.last_seen_at,
  expiresAt: row.expires_at,
  revokedAt: row.revoked_at,
  userAgent: row.user_agent,
  deviceName: row.device_name,
})

const SESSION_COLUMNS =
  "id, user_id, generation, created_at, last_seen_at, expires_at, revoked_at, user_agent, device_name"

export const createSession = async (
  database: D1Database,
  input: {
    readonly userId: string
    readonly userAgent?: string | undefined
    readonly deviceName?: string | undefined
    readonly generation?: number | undefined
    readonly now: number
    readonly ttlMs?: number | undefined
  }
): Promise<SessionRecord> => {
  const record: SessionRecord = {
    id: createOpaqueId(),
    userId: input.userId,
    generation: input.generation ?? 1,
    createdAt: input.now,
    lastSeenAt: input.now,
    expiresAt: input.now + (input.ttlMs ?? D1_SESSION_TOTAL_DURATION_MS),
    revokedAt: null,
    userAgent: input.userAgent ?? null,
    deviceName: input.deviceName ?? null,
  }
  await database
    .prepare(
      "INSERT INTO sessions (id, user_id, generation, created_at, last_seen_at, expires_at, revoked_at, user_agent, device_name) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)"
    )
    .bind(
      record.id,
      record.userId,
      record.generation,
      record.createdAt,
      record.lastSeenAt,
      record.expiresAt,
      record.revokedAt,
      record.userAgent,
      record.deviceName
    )
    .run()
  return record
}

export const findActiveSessionById = async (
  database: D1Database,
  sessionId: string,
  now: number
): Promise<SessionRecord | null> => {
  const row = await database
    .prepare(
      `SELECT ${SESSION_COLUMNS} FROM sessions WHERE id = ?1 AND revoked_at IS NULL AND expires_at > ?2`
    )
    .bind(sessionId, now)
    .first<SessionRow>()
  return row ? mapSessionRow(row) : null
}

export const touchSessionLastSeen = async (
  database: D1Database,
  sessionId: string,
  now: number
): Promise<boolean> => {
  const result = await database
    .prepare(
      "UPDATE sessions SET last_seen_at = ?2 WHERE id = ?1 AND revoked_at IS NULL AND expires_at > ?3"
    )
    .bind(sessionId, now, now)
    .run()
  return (result.meta.changes ?? 0) > 0
}

export const touchSessionActivity = async (
  database: D1Database,
  sessionId: string,
  input: { deviceName: string; now: number }
): Promise<void> => {
  const deviceName = input.deviceName
    .trim()
    .slice(0, SESSION_DEVICE_NAME_MAX_LENGTH)
  if (!deviceName) {
    throw new Error("Device name is required")
  }
  await database
    .prepare(
      "UPDATE sessions SET last_seen_at = ?2, device_name = COALESCE(device_name, ?3) WHERE id = ?1 AND revoked_at IS NULL AND expires_at > ?4"
    )
    .bind(sessionId, input.now, deviceName, input.now)
    .run()
}

export interface AccountSessionEntry {
  id: string
  deviceName: string
  lastActiveAt: number
  createdAt: number
  isCurrent: boolean
}

export const listSessionsForUser = async (
  database: D1Database,
  userId: string,
  currentSessionId: string | null,
  now: number
): Promise<AccountSessionEntry[]> => {
  const { results } = await database
    .prepare(
      `SELECT ${SESSION_COLUMNS} FROM sessions WHERE user_id = ?1 AND revoked_at IS NULL AND expires_at > ?2 ORDER BY last_seen_at DESC LIMIT 50`
    )
    .bind(userId, now)
    .all<SessionRow>()
  return results.map((row) => ({
    id: row.id,
    deviceName: row.device_name ?? "Unknown device",
    lastActiveAt: row.last_seen_at,
    createdAt: row.created_at,
    isCurrent: row.id === currentSessionId,
  }))
}

export const findSessionOwnerById = async (
  database: D1Database,
  sessionId: string
): Promise<string | null> => {
  const row = await database
    .prepare("SELECT user_id FROM sessions WHERE id = ?1")
    .bind(sessionId)
    .first<{ user_id: string }>()
  return row?.user_id ?? null
}

export const revokeSessionById = async (
  database: D1Database,
  sessionId: string,
  now: number
): Promise<boolean> => {
  const result = await database
    .prepare(
      "UPDATE sessions SET revoked_at = ?2 WHERE id = ?1 AND revoked_at IS NULL"
    )
    .bind(sessionId, now)
    .run()
  return (result.meta.changes ?? 0) > 0
}

export const revokeAllSessionsForUser = async (
  database: D1Database,
  userId: string,
  now: number
): Promise<number> => {
  const result = await database
    .prepare(
      "UPDATE sessions SET revoked_at = ?2 WHERE user_id = ?1 AND revoked_at IS NULL"
    )
    .bind(userId, now)
    .run()
  return result.meta.changes ?? 0
}

export const deleteStaleSessions = async (
  database: D1Database,
  now: number
): Promise<number> => {
  const result = await database
    .prepare(
      "DELETE FROM sessions WHERE id IN (SELECT id FROM sessions WHERE expires_at <= ?1 OR revoked_at IS NOT NULL LIMIT ?2)"
    )
    .bind(now, SESSION_SWEEP_BATCH_SIZE)
    .run()
  return result.meta.changes ?? 0
}

export const createD1SessionCookie = (
  sessionId: string,
  maxAgeSeconds = D1_SESSION_COOKIE_MAX_AGE_SECONDS
): string =>
  `${D1_SESSION_COOKIE_NAME}=${encodeURIComponent(sessionId)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`

export const expireD1SessionCookie = (): string =>
  `${D1_SESSION_COOKIE_NAME}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`

export const resolveD1Session = async (
  request: Request,
  database: D1Database
): Promise<SessionRecord | null> => {
  const sessionId = getCookieValue(request, D1_SESSION_COOKIE_NAME)
  if (!sessionId) {
    return null
  }
  return findActiveSessionById(database, sessionId, Date.now())
}

export interface ResolvedSessionContext {
  readonly sessionId: string
  readonly userId: string
  readonly email: string
  readonly displayName?: string | null
  readonly lastSeenAt: number
  readonly expiresAt: number
}

interface SessionContextRow {
  session_id: string
  user_id: string
  email: string
  display_name: string | null
  last_seen_at: number
  expires_at: number
}

export const resolveSessionContext = async (
  request: Request,
  database: D1Database,
  now: number
): Promise<ResolvedSessionContext | null> => {
  const sessionId = getCookieValue(request, D1_SESSION_COOKIE_NAME)
  if (!sessionId) {
    return null
  }
  const row = await database
    .prepare(
      `SELECT s.id AS session_id, s.user_id, s.last_seen_at, s.expires_at, u.email, u.display_name
       FROM sessions s INNER JOIN users u ON u.id = s.user_id
       WHERE s.id = ?1 AND s.revoked_at IS NULL AND s.expires_at > ?2`
    )
    .bind(sessionId, now)
    .first<SessionContextRow>()
  if (!row) {
    return null
  }
  if (now - row.last_seen_at > AUTH_ACTIVITY_TOUCH_INTERVAL_MS) {
    await touchSessionLastSeen(database, row.session_id, now)
  }
  return {
    sessionId: row.session_id,
    userId: row.user_id,
    email: row.email,
    displayName: row.display_name,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
  }
}
