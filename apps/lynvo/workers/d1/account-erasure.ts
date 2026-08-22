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
    .prepare("SELECT * FROM account_erasures WHERE user_id = ?1 LIMIT 1")
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

const ERASURE_STAGE_PROBES = [
  { table: "links", stage: "links" },
  { table: "user_plugin_credentials", stage: "pluginCredentials" },
  { table: "user_plugin_domains", stage: "pluginDomains" },
  { table: "user_plugin_servers", stage: "pluginServers" },
  { table: "device_codes", stage: "deviceCodes" },
  { table: "remote_commands", stage: "remoteCommands" },
  { table: "managed_extraction_operations", stage: "usageCounters" },
] as const satisfies readonly {
  table: ErasureTableKey
  stage: AccountErasureStage
}[]

const getIncompleteDataStage = async (
  database: D1Database,
  userId: string
): Promise<AccountErasureStage | null> => {
  for (const probe of ERASURE_STAGE_PROBES) {
    const keyColumn = ERASURE_TABLE_KEYS[probe.table]
    const row = await database
      .prepare(
        `SELECT ${keyColumn} AS present FROM ${probe.table} WHERE user_id = ?1 LIMIT 1`
      )
      .bind(userId)
      .first<{ present: string | number }>()
    if (row) {
      return probe.stage
    }
  }
  const counterRow = await database
    .prepare("SELECT rowid FROM usage_counters WHERE owner_key = ?1 LIMIT 1")
    .bind(`user:${userId}`)
    .first<{ rowid: number }>()
  if (counterRow) {
    return "usageCounters"
  }
  const ledgerRow = await database
    .prepare("SELECT user_id FROM storage_ledgers WHERE user_id = ?1 LIMIT 1")
    .bind(userId)
    .first<{ user_id: string }>()
  if (ledgerRow) {
    return "storageLedgers"
  }
  const sessionRow = await database
    .prepare("SELECT id FROM sessions WHERE user_id = ?1 LIMIT 1")
    .bind(userId)
    .first<{ id: string }>()
  return sessionRow ? "sessions" : null
}

export type AccountErasureStepOutcome =
  | { kind: "stage"; stage: AccountErasureStage }
  | { kind: "done" }
  | { kind: "missing" }

export const processAccountErasureStep = async (
  database: D1Database,
  userId: string
): Promise<AccountErasureStepOutcome> => {
  const progress = await findErasureProgress(database, userId)
  if (!progress) {
    return { kind: "missing" }
  }
  switch (progress.stage) {
    case "links": {
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
    case "pluginCredentials":
    case "pluginDomains":
    case "pluginServers":
    case "deviceCodes":
    case "remoteCommands": {
      const stageTables = {
        pluginCredentials: "user_plugin_credentials",
        pluginDomains: "user_plugin_domains",
        pluginServers: "user_plugin_servers",
        deviceCodes: "device_codes",
        remoteCommands: "remote_commands",
      } as const
      if (
        (await deleteOwnedBatch(
          database,
          stageTables[progress.stage],
          userId
        )) > 0
      ) {
        return { kind: "stage", stage: progress.stage }
      }
      const nextStage = nextStageAfter(progress.stage)
      await advanceStage(database, progress.id, nextStage)
      return { kind: "stage", stage: nextStage }
    }
    case "usageCounters": {
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
    case "storageLedgers": {
      await database
        .prepare("DELETE FROM storage_ledgers WHERE user_id = ?1")
        .bind(userId)
        .run()
      const nextStage = nextStageAfter("storageLedgers")
      await advanceStage(database, progress.id, nextStage)
      return { kind: "stage", stage: nextStage }
    }
    case "accounts": {
      await eraseUserRow(database, userId)
      return { kind: "done" }
    }
    case "sessions": {
      if ((await deleteOwnedBatch(database, "sessions", userId)) > 0) {
        return { kind: "stage", stage: "sessions" }
      }
      const nextStage = nextStageAfter("sessions")
      await advanceStage(database, progress.id, nextStage)
      return { kind: "stage", stage: nextStage }
    }
    case "finalize": {
      const incompleteStage = await getIncompleteDataStage(database, userId)
      if (incompleteStage) {
        await advanceStage(database, progress.id, incompleteStage)
        return { kind: "stage", stage: incompleteStage }
      }
      await eraseUserRow(database, userId)
      return { kind: "done" }
    }
  }
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

export const drainAccountErasures = async (
  database: D1Database
): Promise<DrainAccountErasuresOutcome> => {
  let stepsRemaining = ACCOUNT_ERASURE_MAX_STEPS_PER_RUN
  let processedUsers = 0
  while (stepsRemaining > 0) {
    const { results } = await database
      .prepare("SELECT user_id FROM account_erasures LIMIT 1")
      .all<{ user_id: string }>()
    const nextUserId = results[0]?.user_id
    if (!nextUserId) {
      break
    }
    const outcome = await processAccountErasureStep(database, nextUserId)
    stepsRemaining -= 1
    if (outcome.kind === "done") {
      processedUsers += 1
    }
  }
  return {
    processedUsers,
    stepsExhausted: stepsRemaining === 0,
  }
}
