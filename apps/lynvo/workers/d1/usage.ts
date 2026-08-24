import {
  DAY_MS,
  GLOBAL_DAILY_LYNVO_PLUGIN_EXTRACTION_LIMIT,
  MANAGED_EXTRACTION_RECOVERY_BATCH_SIZE,
  MANAGED_EXTRACTION_RESERVATION_LEASE_MS,
  USER_DAILY_LYNVO_PLUGIN_EXTRACTION_LIMIT,
  USER_MONTHLY_LYNVO_PLUGIN_EXTRACTION_LIMIT,
} from "../constants"
import {
  createDataVersionBumpStatement,
  executeOwnedWrite,
  getDataVersion,
} from "./data-version"

export const MANAGED_PLUGIN_IDS = [
  "bhadoo-google-drive-index",
  "google-drive-public-files",
  "onedrive-index",
  "direct-media",
] as const

export type ManagedPluginId = (typeof MANAGED_PLUGIN_IDS)[number]

const LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID = "lynvo-plugin-server-operations"
const LYNVO_PLUGIN_SERVER_MONTHLY_METRIC_ID = "lynvo-plugin-server-extractions"
const GLOBAL_USAGE_OWNER_KEY = "global"
const USAGE_COUNTER_INITIAL_VALUE = 1
const DAILY_USAGE_PERIOD = "daily"
const MONTHLY_USAGE_PERIOD = "monthly"

interface UsagePeriod {
  key: string
  resetsAt: number
}

interface ManagedOperationRow {
  user_id: string
  operation_id: string
  plugin_id: ManagedPluginId
  state: "reserved" | "consumed" | "released"
  epoch: number
  daily_period_key: string
  monthly_period_key: string
  user_limits_applied: number
  reserved_at: number
  lease_expires_at: number
  settled_at: number | null
}

interface ManagedOperationRecord {
  userId: string
  operationId: string
  pluginId: ManagedPluginId
  state: "reserved" | "consumed" | "released"
  epoch: number
  dailyPeriodKey: string
  monthlyPeriodKey: string
  userLimitsApplied: boolean
  reservedAt: number
  leaseExpiresAt: number
  settledAt: number | null
}

const mapManagedOperationRow = (
  row: ManagedOperationRow
): ManagedOperationRecord => ({
  userId: row.user_id,
  operationId: row.operation_id,
  pluginId: row.plugin_id,
  state: row.state,
  epoch: row.epoch,
  dailyPeriodKey: row.daily_period_key,
  monthlyPeriodKey: row.monthly_period_key,
  userLimitsApplied: row.user_limits_applied === 1,
  reservedAt: row.reserved_at,
  leaseExpiresAt: row.lease_expires_at,
  settledAt: row.settled_at,
})

const getDailyPeriod = (timestamp: number): UsagePeriod => {
  const now = new Date(timestamp)
  const start = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  )
  return {
    key: new Date(start).toISOString().slice(0, 10),
    resetsAt: start + DAY_MS,
  }
}

const getMonthlyPeriod = (timestamp: number): UsagePeriod => {
  const now = new Date(timestamp)
  const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  return {
    key: new Date(start).toISOString().slice(0, 7),
    resetsAt: Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  }
}

const getEpoch = async (database: D1Database): Promise<number> => {
  const row = await database
    .prepare("SELECT epoch FROM usage_epochs LIMIT 1")
    .first<{ epoch: number }>()
  return row?.epoch ?? 0
}

const readCounterValue = async (
  database: D1Database,
  ownerKey: string,
  metricId: string,
  periodKey: string,
  epoch: number
): Promise<number | null> => {
  const row = await database
    .prepare(
      "SELECT used FROM usage_counters WHERE owner_key = ?1 AND metric_id = ?2 AND period_key = ?3 AND epoch = ?4"
    )
    .bind(ownerKey, metricId, periodKey, epoch)
    .first<{ used: number }>()
  return row?.used ?? null
}

const incrementCounterStatement = (
  database: D1Database,
  input: {
    ownerKey: string
    metricId: string
    periodKey: string
    epoch: number
  }
): D1PreparedStatement =>
  database
    .prepare(
      `INSERT INTO usage_counters (owner_key, metric_id, period_key, epoch, used) VALUES (?1, ?2, ?3, ?4, ${USAGE_COUNTER_INITIAL_VALUE})
       ON CONFLICT(owner_key, metric_id, period_key, epoch) DO UPDATE SET used = used + 1 RETURNING used`
    )
    .bind(input.ownerKey, input.metricId, input.periodKey, input.epoch)

const decrementCounterStatement = (
  database: D1Database,
  input: {
    ownerKey: string
    metricId: string
    periodKey: string
    epoch: number
  }
): D1PreparedStatement =>
  database
    .prepare(
      "UPDATE usage_counters SET used = used - 1 WHERE owner_key = ?1 AND metric_id = ?2 AND period_key = ?3 AND epoch = ?4"
    )
    .bind(input.ownerKey, input.metricId, input.periodKey, input.epoch)

const findManagedOperation = async (
  database: D1Database,
  userId: string,
  operationId: string
): Promise<ManagedOperationRecord | null> => {
  const row = await database
    .prepare(
      "SELECT * FROM managed_extraction_operations WHERE user_id = ?1 AND operation_id = ?2"
    )
    .bind(userId, operationId)
    .first<ManagedOperationRow>()
  return row ? mapManagedOperationRow(row) : null
}

const buildReleaseStatements = async (
  database: D1Database,
  operation: ManagedOperationRecord
): Promise<D1PreparedStatement[]> => {
  const ownerKey = `user:${operation.userId}`
  const counterKeys = [
    [GLOBAL_USAGE_OWNER_KEY, LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID],
    ...(operation.userLimitsApplied
      ? [
          [ownerKey, LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID],
          [ownerKey, LYNVO_PLUGIN_SERVER_MONTHLY_METRIC_ID],
        ]
      : []),
  ] as const
  const counterStates = await Promise.all(
    counterKeys.map(async ([ownerKeyPart, metricId]) => {
      const periodKey =
        metricId === LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID
          ? operation.dailyPeriodKey
          : operation.monthlyPeriodKey
      const used = await readCounterValue(
        database,
        ownerKeyPart,
        metricId,
        periodKey,
        operation.epoch
      )
      if (used === null || used < 1) {
        throw new Error("Managed extraction counter is inconsistent.")
      }
      return { ownerKeyPart, metricId, periodKey }
    })
  )
  return counterStates.map(({ ownerKeyPart, metricId, periodKey }) =>
    decrementCounterStatement(database, {
      ownerKey: ownerKeyPart,
      metricId,
      periodKey,
      epoch: operation.epoch,
    })
  )
}

export type ManagedExtractionReservationResult =
  | { status: "already-reserved"; dataVersion: number }
  | {
      status: "reserved"
      dailyUsed: number
      monthlyUsed: number
      dataVersion: number
    }

export const reserveManagedExtraction = async (
  database: D1Database,
  userId: string,
  input: {
    operationId: string
    pluginId: ManagedPluginId
    usageLimitsDisabled?: boolean | undefined
    now: number
  }
): Promise<ManagedExtractionReservationResult> => {
  const existing = await findManagedOperation(
    database,
    userId,
    input.operationId
  )
  if (existing && existing.state !== "released") {
    return {
      status: "already-reserved",
      dataVersion: await getDataVersion(database, userId),
    }
  }

  const usageLimitsDisabled = input.usageLimitsDisabled === true
  const daily = getDailyPeriod(input.now)
  const monthly = getMonthlyPeriod(input.now)
  const epoch = await getEpoch(database)
  const ownerKey = `user:${userId}`
  const [userDailyUsed, globalDailyUsed, monthlyUsedBefore] = await Promise.all(
    [
      readCounterValue(
        database,
        ownerKey,
        LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID,
        daily.key,
        epoch
      ),
      readCounterValue(
        database,
        GLOBAL_USAGE_OWNER_KEY,
        LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID,
        daily.key,
        epoch
      ),
      readCounterValue(
        database,
        ownerKey,
        LYNVO_PLUGIN_SERVER_MONTHLY_METRIC_ID,
        monthly.key,
        epoch
      ),
    ]
  )
  if (
    !usageLimitsDisabled &&
    (userDailyUsed ?? 0) >= USER_DAILY_LYNVO_PLUGIN_EXTRACTION_LIMIT
  ) {
    throw new Error("Daily Lynvo Plugin extraction limit reached.")
  }
  if ((globalDailyUsed ?? 0) >= GLOBAL_DAILY_LYNVO_PLUGIN_EXTRACTION_LIMIT) {
    throw new Error(
      "Lynvo Plugin extraction capacity is unavailable until tomorrow."
    )
  }
  if (
    !usageLimitsDisabled &&
    (monthlyUsedBefore ?? 0) >= USER_MONTHLY_LYNVO_PLUGIN_EXTRACTION_LIMIT
  ) {
    throw new Error("Monthly Lynvo Plugin extraction limit reached.")
  }

  const statements = [
    incrementCounterStatement(database, {
      ownerKey: GLOBAL_USAGE_OWNER_KEY,
      metricId: LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID,
      periodKey: daily.key,
      epoch,
    }),
  ]
  if (!usageLimitsDisabled) {
    statements.push(
      incrementCounterStatement(database, {
        ownerKey,
        metricId: LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID,
        periodKey: daily.key,
        epoch,
      }),
      incrementCounterStatement(database, {
        ownerKey,
        metricId: LYNVO_PLUGIN_SERVER_MONTHLY_METRIC_ID,
        periodKey: monthly.key,
        epoch,
      })
    )
  }
  statements.push(
    database
      .prepare(
        `INSERT INTO managed_extraction_operations (user_id, operation_id, plugin_id, state, epoch, daily_period_key, monthly_period_key, user_limits_applied, reserved_at, lease_expires_at, settled_at) VALUES (?1, ?2, ?3, 'reserved', ?4, ?5, ?6, ?7, ?8, ?9, NULL)
         ON CONFLICT(user_id, operation_id) DO UPDATE SET plugin_id = ?3, state = 'reserved', epoch = ?4, daily_period_key = ?5, monthly_period_key = ?6, user_limits_applied = ?7, reserved_at = ?8, lease_expires_at = ?9, settled_at = NULL`
      )
      .bind(
        userId,
        input.operationId,
        input.pluginId,
        epoch,
        daily.key,
        monthly.key,
        usageLimitsDisabled ? 0 : 1,
        input.now,
        input.now + MANAGED_EXTRACTION_RESERVATION_LEASE_MS
      )
  )
  const { dataVersion, statementResults } = await executeOwnedWrite(
    database,
    userId,
    statements
  )
  let dailyUsed: number
  let monthlyUsed: number
  if (usageLimitsDisabled) {
    dailyUsed = userDailyUsed ?? 0
    monthlyUsed = monthlyUsedBefore ?? 0
  } else {
    // SAFETY: both user counter increments RETURNING exactly one row inside the committed batch.
    const dailyRow = statementResults[1]?.results?.[0] as
      | { used: number }
      | undefined
    // SAFETY: see dailyRow; the monthly increment is statement index 2 by construction.
    const monthlyRow = statementResults[2]?.results?.[0] as
      | { used: number }
      | undefined
    if (!dailyRow || !monthlyRow) {
      throw new Error("Managed extraction counter is inconsistent.")
    }
    dailyUsed = dailyRow.used
    monthlyUsed = monthlyRow.used
  }
  return { status: "reserved", dailyUsed, monthlyUsed, dataVersion }
}

export type ManagedExtractionSettlementResult =
  | { status: "already-settled"; dataVersion: number }
  | { status: "consumed" | "released"; dataVersion: number }

export const settleManagedExtraction = async (
  database: D1Database,
  userId: string,
  input: {
    operationId: string
    outcome: "consumed" | "released"
    now: number
  }
): Promise<ManagedExtractionSettlementResult> => {
  const operation = await findManagedOperation(
    database,
    userId,
    input.operationId
  )
  if (!operation) {
    throw new Error("Managed extraction reservation not found.")
  }
  if (operation.state !== "reserved") {
    return {
      status: "already-settled",
      dataVersion: await getDataVersion(database, userId),
    }
  }
  const releaseStatements =
    input.outcome === "released"
      ? await buildReleaseStatements(database, operation)
      : []
  const { dataVersion } = await executeOwnedWrite(database, userId, [
    ...releaseStatements,
    database
      .prepare(
        "UPDATE managed_extraction_operations SET state = ?3, settled_at = ?2 WHERE user_id = ?1 AND operation_id = ?4"
      )
      .bind(userId, input.now, input.outcome, input.operationId),
  ])
  return { status: input.outcome, dataVersion }
}

export const releaseExpiredManagedExtractions = async (
  database: D1Database,
  now: number
): Promise<{ released: number }> => {
  const { results } = await database
    .prepare(
      "SELECT * FROM managed_extraction_operations WHERE state = 'reserved' AND lease_expires_at <= ?1 LIMIT ?2"
    )
    .bind(now, MANAGED_EXTRACTION_RECOVERY_BATCH_SIZE)
    .all<ManagedOperationRow>()
  if (results.length === 0) {
    return { released: 0 }
  }
  const operations = results.map(mapManagedOperationRow)
  const releaseStatementsByOperation = await Promise.all(
    operations.map((operation) => buildReleaseStatements(database, operation))
  )
  const statements: D1PreparedStatement[] = []
  const affectedUserIds = new Set<string>()
  for (const [operationIndex, operation] of operations.entries()) {
    statements.push(
      ...(releaseStatementsByOperation[operationIndex] ?? []),
      database
        .prepare(
          "UPDATE managed_extraction_operations SET state = 'released', settled_at = ?3 WHERE user_id = ?1 AND operation_id = ?2"
        )
        .bind(operation.userId, operation.operationId, now)
    )
    affectedUserIds.add(operation.userId)
  }
  for (const affectedUserId of affectedUserIds) {
    statements.push(createDataVersionBumpStatement(database, affectedUserId))
  }
  await database.batch(statements)
  return { released: operations.length }
}

export interface UsageMetricSnapshot {
  id: string
  label: string
  used: number
  limit: number
  unit: string
  period: string
  resetsAt: string
}

export const getUsage = async (
  database: D1Database,
  userId: string,
  timestamp: number
): Promise<{ metrics: UsageMetricSnapshot[] }> => {
  const daily = getDailyPeriod(timestamp)
  const monthly = getMonthlyPeriod(timestamp)
  const epoch = await getEpoch(database)
  const ownerKey = `user:${userId}`
  const [dailyUsed, monthlyUsed] = await Promise.all([
    readCounterValue(
      database,
      ownerKey,
      LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID,
      daily.key,
      epoch
    ),
    readCounterValue(
      database,
      ownerKey,
      LYNVO_PLUGIN_SERVER_MONTHLY_METRIC_ID,
      monthly.key,
      epoch
    ),
  ])
  return {
    metrics: [
      {
        id: LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID,
        label: "Daily Lynvo Plugin extractions",
        used: dailyUsed ?? 0,
        limit: USER_DAILY_LYNVO_PLUGIN_EXTRACTION_LIMIT,
        unit: "extractions",
        period: DAILY_USAGE_PERIOD,
        resetsAt: new Date(daily.resetsAt).toISOString(),
      },
      {
        id: LYNVO_PLUGIN_SERVER_MONTHLY_METRIC_ID,
        label: "Lynvo Plugin extractions",
        used: monthlyUsed ?? 0,
        limit: USER_MONTHLY_LYNVO_PLUGIN_EXTRACTION_LIMIT,
        unit: "extractions",
        period: MONTHLY_USAGE_PERIOD,
        resetsAt: new Date(monthly.resetsAt).toISOString(),
      },
    ],
  }
}

export const resetUsageEpoch = async (
  database: D1Database,
  now: number
): Promise<{ epoch: number }> => {
  const currentEpoch = await getEpoch(database)
  const nextEpoch = currentEpoch + 1
  await database
    .prepare(
      "INSERT OR IGNORE INTO usage_epochs (epoch, updated_at) VALUES (?1, ?2)"
    )
    .bind(nextEpoch, now)
    .run()
  return { epoch: nextEpoch }
}
