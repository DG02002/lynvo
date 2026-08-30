import {
  ACCOUNT_ERASURE_BATCH_SIZE,
  ACCOUNT_ERASURE_MAX_STEPS_PER_RUN,
} from "../constants"
import { createOpaqueId } from "./ids"

export const ERASURE_STAGE_ORDER = [
  "links",
  "pluginCredentials",
  "pluginDomains",
  "pluginServers",
  "deviceCodes",
  "remoteCommands",
  "usageCounters",
  "storageLedgers",
  "accounts",
  "sessions",
  "finalize",
] as const

export type AccountErasureStage = (typeof ERASURE_STAGE_ORDER)[number]

export type AccountErasureTrigger = "manual" | "inactive"

interface AccountErasureRow {
  id: string
  user_id: string
  stage: AccountErasureStage
  trigger_kind: AccountErasureTrigger
  started_at: number
  cleanup_processed_users: number | null
  cleanup_started_at: number | null
}

interface AccountErasureDataPresence {
  links: number
  pluginCredentials: number
  pluginDomains: number
  pluginServers: number
  deviceCodes: number
  remoteCommands: number
  managedExtractions: number
  usageCounters: number
  storageLedgers: number
  sessions: number
}

export interface AccountErasureProgress {
  id: string
  userId: string
  stage: AccountErasureStage
  trigger: AccountErasureTrigger
  startedAt: number
}

const mapErasureRow = (row: AccountErasureRow): AccountErasureProgress => ({
  id: row.id,
  userId: row.user_id,
  stage: row.stage,
  trigger: row.trigger_kind,
  startedAt: row.started_at,
})

const nextStageAfter = (stage: AccountErasureStage): AccountErasureStage =>
  ERASURE_STAGE_ORDER[ERASURE_STAGE_ORDER.indexOf(stage) + 1]

const findErasureProgress = async (
  database: D1Database,
  userId: string
): Promise<AccountErasureProgress | null> => {
  const row = await database
    .prepare(
      "SELECT id, user_id, stage, trigger_kind, started_at, cleanup_processed_users, cleanup_started_at FROM account_erasures WHERE user_id = ?1 LIMIT 1"
    )
    .bind(userId)
    .first<AccountErasureRow>()
  return row ? mapErasureRow(row) : null
}

const advanceStage = async (
  database: D1Database,
  erasureId: string,
  stage: AccountErasureStage
): Promise<void> => {
  await database
    .prepare("UPDATE account_erasures SET stage = ?2 WHERE id = ?1")
    .bind(erasureId, stage)
    .run()
}

const ERASURE_TABLE_KEYS = {
  links: "id",
  user_plugin_credentials: "id",
  user_plugin_domains: "id",
  user_plugin_servers: "id",
  device_codes: "code",
  remote_commands: "id",
  managed_extraction_operations: "rowid",
  sessions: "id",
} as const

const ERASURE_STAGE_TABLES = {
  pluginCredentials: "user_plugin_credentials",
  pluginDomains: "user_plugin_domains",
  pluginServers: "user_plugin_servers",
  deviceCodes: "device_codes",
  remoteCommands: "remote_commands",
} as const

type ErasureTableKey = keyof typeof ERASURE_TABLE_KEYS

const deleteOwnedBatch = async (
  database: D1Database,
  table: ErasureTableKey,
  userId: string
): Promise<number> => {
  const keyColumn = ERASURE_TABLE_KEYS[table]
  const result = await database
    .prepare(
      `DELETE FROM ${table} WHERE ${keyColumn} IN (SELECT ${keyColumn} FROM ${table} WHERE user_id = ?1 LIMIT ?2)`
    )
    .bind(userId, ACCOUNT_ERASURE_BATCH_SIZE)
    .run()
  return result.meta.changes ?? 0
}

const deleteLinkCommandOperationBatch = async (
  database: D1Database,
  userId: string
): Promise<number> => {
  const result = await database
    .prepare(
      "DELETE FROM link_command_operations WHERE rowid IN (SELECT rowid FROM link_command_operations WHERE user_id = ?1 LIMIT ?2)"
    )
    .bind(userId, ACCOUNT_ERASURE_BATCH_SIZE)
    .run()
  return result.meta.changes ?? 0
}

const deleteUsageCounterBatch = async (
  database: D1Database,
  userId: string
): Promise<number> => {
  const result = await database
    .prepare(
      "DELETE FROM usage_counters WHERE rowid IN (SELECT rowid FROM usage_counters WHERE owner_key = ?1 LIMIT ?2)"
    )
    .bind(`user:${userId}`, ACCOUNT_ERASURE_BATCH_SIZE)
    .run()
  return result.meta.changes ?? 0
}

const eraseUserRow = async (
  database: D1Database,
  userId: string
): Promise<void> => {
  await database.prepare("DELETE FROM users WHERE id = ?1").bind(userId).run()
}

const getIncompleteDataStage = async (
  database: D1Database,
  userId: string
): Promise<AccountErasureStage | null> => {
  const presence = await database
    .prepare(
      `SELECT
         EXISTS (SELECT 1 FROM links WHERE user_id = ?1) AS links,
         EXISTS (SELECT 1 FROM user_plugin_credentials WHERE user_id = ?1) AS pluginCredentials,
         EXISTS (SELECT 1 FROM user_plugin_domains WHERE user_id = ?1) AS pluginDomains,
         EXISTS (SELECT 1 FROM user_plugin_servers WHERE user_id = ?1) AS pluginServers,
         EXISTS (SELECT 1 FROM device_codes WHERE user_id = ?1) AS deviceCodes,
         EXISTS (SELECT 1 FROM remote_commands WHERE user_id = ?1) AS remoteCommands,
         EXISTS (SELECT 1 FROM managed_extraction_operations WHERE user_id = ?1) AS managedExtractions,
         EXISTS (SELECT 1 FROM usage_counters WHERE owner_key = ?2) AS usageCounters,
         EXISTS (SELECT 1 FROM storage_ledgers WHERE user_id = ?1) AS storageLedgers,
         EXISTS (SELECT 1 FROM sessions WHERE user_id = ?1) AS sessions`
    )
    .bind(userId, `user:${userId}`)
    .first<AccountErasureDataPresence>()
  if (!presence) {
    return null
  }
  const presenceByStage = {
    links: Boolean(presence.links),
    pluginCredentials: Boolean(presence.pluginCredentials),
    pluginDomains: Boolean(presence.pluginDomains),
    pluginServers: Boolean(presence.pluginServers),
    deviceCodes: Boolean(presence.deviceCodes),
    remoteCommands: Boolean(presence.remoteCommands),
    usageCounters: Boolean(
      presence.managedExtractions || presence.usageCounters
    ),
    storageLedgers: Boolean(presence.storageLedgers),
    sessions: Boolean(presence.sessions),
  } satisfies Partial<Record<AccountErasureStage, boolean>>
  const incompleteStages = new Set(
    Object.entries(presenceByStage).flatMap(([stage, isPresent]) =>
      isPresent ? [stage] : []
    )
  )
  return (
    ERASURE_STAGE_ORDER.find((stage) => incompleteStages.has(stage)) ?? null
  )
}

export type AccountErasureStepOutcome =
  | { kind: "stage"; stage: AccountErasureStage }
  | { kind: "done" }
  | { kind: "missing" }

interface AccountErasureStageProcessorInput {
  database: D1Database
  userId: string
  progress: AccountErasureProgress
}

interface AccountErasureStageProcessor {
  (input: AccountErasureStageProcessorInput): Promise<AccountErasureStepOutcome>
}

interface AccountErasureStageProcessorMap {
  links: AccountErasureStageProcessor
  pluginCredentials: AccountErasureStageProcessor
  pluginDomains: AccountErasureStageProcessor
  pluginServers: AccountErasureStageProcessor
  deviceCodes: AccountErasureStageProcessor
  remoteCommands: AccountErasureStageProcessor
  usageCounters: AccountErasureStageProcessor
  storageLedgers: AccountErasureStageProcessor
  accounts: AccountErasureStageProcessor
  sessions: AccountErasureStageProcessor
  finalize: AccountErasureStageProcessor
}

const processLinksErasureStage = async ({
  database,
  userId,
  progress,
}: AccountErasureStageProcessorInput): Promise<AccountErasureStepOutcome> => {
  if ((await deleteOwnedBatch(database, "links", userId)) > 0) {
    return { kind: "stage", stage: "links" }
  }
  if ((await deleteLinkCommandOperationBatch(database, userId)) > 0) {
    return { kind: "stage", stage: "links" }
  }
  const nextStage = nextStageAfter("links")
  await advanceStage(database, progress.id, nextStage)
  return { kind: "stage", stage: nextStage }
}

const processPluginServerDataErasureStage = async (
  { database, userId, progress }: AccountErasureStageProcessorInput,
  table: ErasureTableKey
): Promise<AccountErasureStepOutcome> => {
  if ((await deleteOwnedBatch(database, table, userId)) > 0) {
    return { kind: "stage", stage: progress.stage }
  }
  const nextStage = nextStageAfter(progress.stage)
  await advanceStage(database, progress.id, nextStage)
  return { kind: "stage", stage: nextStage }
}

const processUsageCountersErasureStage = async ({
  database,
  userId,
  progress,
}: AccountErasureStageProcessorInput): Promise<AccountErasureStepOutcome> => {
  if (
    (await deleteOwnedBatch(
      database,
      "managed_extraction_operations",
      userId
    )) > 0
  ) {
    return { kind: "stage", stage: "usageCounters" }
  }
  if ((await deleteUsageCounterBatch(database, userId)) > 0) {
    return { kind: "stage", stage: "usageCounters" }
  }
  const nextStage = nextStageAfter("usageCounters")
  await advanceStage(database, progress.id, nextStage)
  return { kind: "stage", stage: nextStage }
}

const processStorageLedgersErasureStage = async ({
  database,
  progress,
  userId,
}: AccountErasureStageProcessorInput): Promise<AccountErasureStepOutcome> => {
  await database
    .prepare("DELETE FROM storage_ledgers WHERE user_id = ?1")
    .bind(userId)
    .run()
  const nextStage = nextStageAfter("storageLedgers")
  await advanceStage(database, progress.id, nextStage)
  return { kind: "stage", stage: nextStage }
}

const processAccountsErasureStage = async ({
  database,
  userId,
}: AccountErasureStageProcessorInput): Promise<AccountErasureStepOutcome> => {
  await eraseUserRow(database, userId)
  return { kind: "done" }
}

const processSessionsErasureStage = async ({
  database,
  userId,
  progress,
}: AccountErasureStageProcessorInput): Promise<AccountErasureStepOutcome> => {
  if ((await deleteOwnedBatch(database, "sessions", userId)) > 0) {
    return { kind: "stage", stage: "sessions" }
  }
  const nextStage = nextStageAfter("sessions")
  await advanceStage(database, progress.id, nextStage)
  return { kind: "stage", stage: nextStage }
}

const processFinalizeErasureStage = async ({
  database,
  userId,
  progress,
}: AccountErasureStageProcessorInput): Promise<AccountErasureStepOutcome> => {
  const incompleteStage = await getIncompleteDataStage(database, userId)
  if (incompleteStage) {
    await advanceStage(database, progress.id, incompleteStage)
    return { kind: "stage", stage: incompleteStage }
  }
  await eraseUserRow(database, userId)
  return { kind: "done" }
}

const ACCOUNT_ERASURE_STAGE_PROCESSORS: AccountErasureStageProcessorMap = {
  links: processLinksErasureStage,
  pluginCredentials: (input) =>
    processPluginServerDataErasureStage(
      input,
      ERASURE_STAGE_TABLES.pluginCredentials
    ),
  pluginDomains: (input) =>
    processPluginServerDataErasureStage(
      input,
      ERASURE_STAGE_TABLES.pluginDomains
    ),
  pluginServers: (input) =>
    processPluginServerDataErasureStage(
      input,
      ERASURE_STAGE_TABLES.pluginServers
    ),
  deviceCodes: (input) =>
    processPluginServerDataErasureStage(
      input,
      ERASURE_STAGE_TABLES.deviceCodes
    ),
  remoteCommands: (input) =>
    processPluginServerDataErasureStage(
      input,
      ERASURE_STAGE_TABLES.remoteCommands
    ),
  usageCounters: processUsageCountersErasureStage,
  storageLedgers: processStorageLedgersErasureStage,
  accounts: processAccountsErasureStage,
  sessions: processSessionsErasureStage,
  finalize: processFinalizeErasureStage,
}

export const processAccountErasureStep = async (
  database: D1Database,
  userId: string
): Promise<AccountErasureStepOutcome> => {
  const progress = await findErasureProgress(database, userId)
  if (!progress) {
    return { kind: "missing" }
  }
  return ACCOUNT_ERASURE_STAGE_PROCESSORS[progress.stage]({
    database,
    userId,
    progress,
  })
}

export const initiateAccountErasure = async (
  database: D1Database,
  userId: string,
  input: {
    trigger: AccountErasureTrigger
    now: number
    cleanup?: { processedUsers: number; startedAt: number } | undefined
  }
): Promise<boolean> => {
  const existing = await findErasureProgress(database, userId)
  if (existing) {
    return false
  }
  const user = await database
    .prepare("SELECT id FROM users WHERE id = ?1")
    .bind(userId)
    .first<{ id: string }>()
  if (!user) {
    return false
  }
  await database.batch([
    database
      .prepare(
        "INSERT INTO account_erasures (id, user_id, stage, trigger_kind, started_at, cleanup_processed_users, cleanup_started_at) VALUES (?1, ?2, 'links', ?3, ?4, ?5, ?6)"
      )
      .bind(
        createOpaqueId(),
        userId,
        input.trigger,
        input.now,
        input.cleanup?.processedUsers ?? null,
        input.cleanup?.startedAt ?? null
      ),
    database
      .prepare("UPDATE users SET erasure_pending_at = ?2 WHERE id = ?1")
      .bind(userId, input.now),
  ])
  return true
}

export interface DrainAccountErasuresOutcome {
  processedUsers: number
  stepsExhausted: boolean
}

interface DrainAccountErasuresState {
  database: D1Database
  targetUserId: string | undefined
  stepsRemaining: number
  processedUsers: number
}

const selectNextAccountErasureUserId = async (
  database: D1Database
): Promise<string | null> => {
  const row = await database
    .prepare("SELECT user_id FROM account_erasures LIMIT 1")
    .first<{ user_id: string }>()
  return row?.user_id ?? null
}

const drainNextAccountErasure = async ({
  database,
  targetUserId,
  stepsRemaining,
  processedUsers,
}: DrainAccountErasuresState): Promise<DrainAccountErasuresOutcome> => {
  if (stepsRemaining === 0) {
    return { processedUsers, stepsExhausted: true }
  }
  const nextUserId =
    targetUserId ?? (await selectNextAccountErasureUserId(database))
  if (!nextUserId) {
    return { processedUsers, stepsExhausted: false }
  }
  const outcome = await processAccountErasureStep(database, nextUserId)
  const nextProcessedUsers =
    outcome.kind === "done" ? processedUsers + 1 : processedUsers
  const nextStepsRemaining = stepsRemaining - 1
  if (outcome.kind !== "stage" && targetUserId) {
    return {
      processedUsers: nextProcessedUsers,
      stepsExhausted: nextStepsRemaining === 0,
    }
  }
  return drainNextAccountErasure({
    database,
    targetUserId,
    stepsRemaining: nextStepsRemaining,
    processedUsers: nextProcessedUsers,
  })
}

export const drainAccountErasures = async (
  database: D1Database,
  targetUserId?: string
): Promise<DrainAccountErasuresOutcome> =>
  drainNextAccountErasure({
    database,
    targetUserId,
    stepsRemaining: ACCOUNT_ERASURE_MAX_STEPS_PER_RUN,
    processedUsers: 0,
  })
