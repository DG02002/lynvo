import { createOpaqueId } from "./ids"
import {
  DAY_MS,
  DEFAULT_RETENTION_DAYS,
  STORAGE_RETENTION_DAY_OPTIONS,
} from "../constants"
import { executeOwnedWrite, getDataVersion } from "./data-version"
import {
  applyStorageMutation,
  byteLength,
  ensureStorageLedger,
} from "./storage-ledger"
import {
  profileStorageDocument,
  USER_COLUMNS,
  type ProfileUserRow,
} from "./rows"

export interface UserRecord {
  id: string
  googleSubject: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  dataVersion: number
  erasurePendingAt: number | null
  storageRetentionDays: number
  rangeSupportedPlayerId: string | null
  rangeUnsupportedPlayerId: string | null
  createdAt: number
}

interface UserRow {
  id: string
  google_subject: string
  email: string
  display_name: string | null
  avatar_url: string | null
  data_version: number
  erasure_pending_at: number | null
  storage_retention_days: number
  range_supported_player_id: string | null
  range_unsupported_player_id: string | null
  created_at: number
}

const mapUserRow = (row: UserRow): UserRecord => ({
  id: row.id,
  googleSubject: row.google_subject,
  email: row.email,
  displayName: row.display_name,
  avatarUrl: row.avatar_url,
  dataVersion: row.data_version,
  erasurePendingAt: row.erasure_pending_at,
  storageRetentionDays: row.storage_retention_days,
  rangeSupportedPlayerId: row.range_supported_player_id,
  rangeUnsupportedPlayerId: row.range_unsupported_player_id,
  createdAt: row.created_at,
})

export const findUserByGoogleSubject = async (
  database: D1Database,
  googleSubject: string
): Promise<UserRecord | null> => {
  const row = await database
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE google_subject = ?1`)
    .bind(googleSubject)
    .first<UserRow>()
  return row ? mapUserRow(row) : null
}

export const getUserById = async (
  database: D1Database,
  userId: string
): Promise<UserRecord | null> => {
  const row = await database
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?1`)
    .bind(userId)
    .first<UserRow>()
  return row ? mapUserRow(row) : null
}

export const insertGoogleUser = async (
  database: D1Database,
  input: {
    readonly googleSubject: string
    readonly email: string
    readonly displayName?: string | undefined
    readonly avatarUrl?: string | undefined
    readonly now: number
  }
): Promise<UserRecord> => {
  const record: UserRecord = {
    id: createOpaqueId(),
    googleSubject: input.googleSubject,
    email: input.email,
    displayName: input.displayName ?? null,
    avatarUrl: input.avatarUrl ?? null,
    dataVersion: 1,
    erasurePendingAt: null,
    storageRetentionDays: DEFAULT_RETENTION_DAYS,
    rangeSupportedPlayerId: null,
    rangeUnsupportedPlayerId: null,
    createdAt: input.now,
  }
  await database
    .prepare(
      "INSERT INTO users (id, google_subject, email, display_name, avatar_url, data_version, erasure_pending_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)"
    )
    .bind(
      record.id,
      record.googleSubject,
      record.email,
      record.displayName,
      record.avatarUrl,
      record.dataVersion,
      record.erasurePendingAt,
      record.createdAt
    )
    .run()
  return record
}

export const getOrCreateGoogleUser = async (
  database: D1Database,
  input: {
    readonly googleSubject: string
    readonly email: string
    readonly displayName?: string | undefined
    readonly avatarUrl?: string | undefined
    readonly now: number
  }
): Promise<{ user: UserRecord; didCreate: boolean }> => {
  const existing = await findUserByGoogleSubject(database, input.googleSubject)
  if (existing) {
    return { user: existing, didCreate: false }
  }
  try {
    return { user: await insertGoogleUser(database, input), didCreate: true }
  } catch {
    const raced = await findUserByGoogleSubject(database, input.googleSubject)
    if (!raced) {
      throw new Error("Unable to create user for Google subject")
    }
    return { user: raced, didCreate: false }
  }
}

export const normalizeRetentionDays = (retentionDays: number): number => {
  if (!STORAGE_RETENTION_DAY_OPTIONS.includes(retentionDays)) {
    throw new Error("Choose an available auto-delete period")
  }
  return retentionDays
}

const readRawUserRow = async (
  database: D1Database,
  userId: string
): Promise<ProfileUserRow | null> =>
  database
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?1`)
    .bind(userId)
    .first<ProfileUserRow>()

export interface UpdateStorageRetentionDaysResult {
  success: boolean
  dataVersion: number
}

export const updateUserStorageRetentionDays = async (
  database: D1Database,
  userId: string,
  input: { days: number; now: number }
): Promise<UpdateStorageRetentionDaysResult> => {
  const retentionDays = normalizeRetentionDays(input.days)
  const currentUserRow = await readRawUserRow(database, userId)
  if (!currentUserRow) {
    throw new Error("Authentication required")
  }
  const currentProfileDocument = profileStorageDocument(currentUserRow)
  const nextProfileDocument: ProfileUserRow = {
    ...currentProfileDocument,
    storage_retention_days: retentionDays,
  }
  const preparation = await ensureStorageLedger(database, userId, input.now)
  const ledgerMutation = applyStorageMutation(
    database,
    preparation,
    {
      domain: "profileBytes",
      currentBytes: byteLength(currentProfileDocument),
      nextBytes: byteLength(nextProfileDocument),
      savedLinkCountDelta: 0,
    },
    input.now
  )
  const { dataVersion } = await executeOwnedWrite(database, userId, [
    ...preparation.statements,
    database
      .prepare("UPDATE users SET storage_retention_days = ?2 WHERE id = ?1")
      .bind(userId, retentionDays),
    database
      .prepare(
        "UPDATE links SET expires_at = created_at + ?2 WHERE user_id = ?1"
      )
      .bind(userId, retentionDays * DAY_MS),
    ...ledgerMutation.statements,
  ])
  return { success: true, dataVersion }
}

export interface PlayerPreferences {
  rangeSupportedPlayerId?: string | undefined
  rangeUnsupportedPlayerId?: string | undefined
}

export const PLAYER_IDS = ["just", "vlc", "mpv", "mx"]

export const normalizePlayerId = (playerId: string): string => {
  if (!PLAYER_IDS.includes(playerId)) {
    throw new Error(
      "Choose Just (Video) Player, VLC for Android, MPV, or MX Player"
    )
  }
  return playerId
}

export const getUserPlayerPreferences = async (
  database: D1Database,
  userId: string
): Promise<PlayerPreferences> => {
  const row = await database
    .prepare(
      "SELECT range_supported_player_id, range_unsupported_player_id FROM users WHERE id = ?1"
    )
    .bind(userId)
    .first<{
      range_supported_player_id: string | null
      range_unsupported_player_id: string | null
    }>()
  return {
    rangeSupportedPlayerId: row?.range_supported_player_id ?? undefined,
    rangeUnsupportedPlayerId: row?.range_unsupported_player_id ?? undefined,
  }
}

export const updateUserPlayerPreferences = async (
  database: D1Database,
  userId: string,
  input: PlayerPreferences & { now: number }
): Promise<{ success: boolean; dataVersion: number }> => {
  const currentUserRow = await readRawUserRow(database, userId)
  if (!currentUserRow) {
    throw new Error("Authentication required")
  }
  const currentProfileDocument = profileStorageDocument(currentUserRow)
  const nextProfileDocument: ProfileUserRow = {
    ...currentProfileDocument,
    range_supported_player_id:
      input.rangeSupportedPlayerId === undefined
        ? currentProfileDocument.range_supported_player_id
        : normalizePlayerId(input.rangeSupportedPlayerId),
    range_unsupported_player_id:
      input.rangeUnsupportedPlayerId === undefined
        ? currentProfileDocument.range_unsupported_player_id
        : normalizePlayerId(input.rangeUnsupportedPlayerId),
  }
  if (
    nextProfileDocument.range_supported_player_id ===
      currentProfileDocument.range_supported_player_id &&
    nextProfileDocument.range_unsupported_player_id ===
      currentProfileDocument.range_unsupported_player_id
  ) {
    return {
      success: true,
      dataVersion: await getDataVersion(database, userId),
    }
  }
  const preparation = await ensureStorageLedger(database, userId, input.now)
  const ledgerMutation = applyStorageMutation(
    database,
    preparation,
    {
      domain: "profileBytes",
      currentBytes: byteLength(currentProfileDocument),
      nextBytes: byteLength(nextProfileDocument),
      savedLinkCountDelta: 0,
    },
    input.now
  )
  const { dataVersion } = await executeOwnedWrite(database, userId, [
    ...preparation.statements,
    database
      .prepare(
        "UPDATE users SET range_supported_player_id = ?2, range_unsupported_player_id = ?3 WHERE id = ?1"
      )
      .bind(
        userId,
        nextProfileDocument.range_supported_player_id,
        nextProfileDocument.range_unsupported_player_id
      ),
    ...ledgerMutation.statements,
  ])
  return { success: true, dataVersion }
}
