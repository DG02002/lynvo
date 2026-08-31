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

const MANAGED_OPERATION_COLUMNS =
  "user_id, operation_id, plugin_id, state, epoch, daily_period_key, monthly_period_key, user_limits_applied, reserved_at, lease_expires_at, settled_at"

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

interface ManagedOperationCounterIdentity {
  readonly ownerKey: string
  readonly metricId: string
  readonly periodKey: string
  readonly epoch: number
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

/** Quota exhaustion carrying the seconds until the limiting period resets. */
export class UsageLimitExhaustedError extends Error {
  readonly retryAfterSeconds: number

  constructor(message: string, resetsAt: number, now: number) {
    super(message)
    this.name = "UsageLimitExhaustedError"
    this.retryAfterSeconds = Math.max(1, Math.ceil((resetsAt - now) / 1000))
  }
}

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
    .prepare("SELECT COALESCE(MAX(epoch), 0) AS epoch FROM usage_epochs")
    .first<{ epoch: number }>()
  return row?.epoch ?? 0
}

interface ReadCounterValueInput {
  readonly database: D1Database
  readonly ownerKey: string
  readonly metricId: string
  readonly periodKey: string
  readonly epoch: number
}

const readCounterValue = async ({
  database,
  ownerKey,
  metricId,
  periodKey,
  epoch,
}: ReadCounterValueInput): Promise<number | null> => {
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
    limit: number
  }
): D1PreparedStatement =>
  database
    .prepare(
      `INSERT INTO usage_counters (owner_key, metric_id, period_key, epoch, used) VALUES (?1, ?2, ?3, ?4, ${USAGE_COUNTER_INITIAL_VALUE})
       ON CONFLICT(owner_key, metric_id, period_key, epoch) DO UPDATE SET used = used + 1 WHERE used + 1 <= ?5 RETURNING used`
    )
    .bind(
      input.ownerKey,
      input.metricId,
      input.periodKey,
      input.epoch,
      input.limit
    )

const decrementCounterStatement = (
  database: D1Database,
  input: {
    ownerKey: string
    metricId: string
    periodKey: string
    epoch: number
    userId: string
    operationId: string
  }
): D1PreparedStatement =>
  database
    .prepare(
      `UPDATE usage_counters SET used = used - 1
       WHERE owner_key = ?1 AND metric_id = ?2 AND period_key = ?3 AND epoch = ?4 AND used > 0
         AND EXISTS (
           SELECT 1 FROM managed_extraction_operations
           WHERE user_id = ?5 AND operation_id = ?6 AND state = 'reserved'
         )`
    )
    .bind(
      input.ownerKey,
      input.metricId,
      input.periodKey,
      input.epoch,
      input.userId,
      input.operationId
    )

const findManagedOperation = async (
  database: D1Database,
  userId: string,
  operationId: string
): Promise<ManagedOperationRecord | null> => {
  const row = await database
    .prepare(
      `SELECT ${MANAGED_OPERATION_COLUMNS} FROM managed_extraction_operations WHERE user_id = ?1 AND operation_id = ?2`
    )
    .bind(userId, operationId)
    .first<ManagedOperationRow>()
  return row ? mapManagedOperationRow(row) : null
}

const readExpiredManagedOperations = async (
  database: D1Database,
  now: number
): Promise<readonly ManagedOperationRecord[]> => {
  const { results } = await database
    .prepare(
      `SELECT ${MANAGED_OPERATION_COLUMNS}
       FROM managed_extraction_operations
       WHERE state = 'reserved' AND lease_expires_at <= ?1
       ORDER BY lease_expires_at, user_id, operation_id
       LIMIT ?2`
    )
    .bind(now, MANAGED_EXTRACTION_RECOVERY_BATCH_SIZE)
    .all<ManagedOperationRow>()
  return results.map(mapManagedOperationRow)
}

const getManagedOperationCounterIdentities = (
  operation: ManagedOperationRecord
): readonly ManagedOperationCounterIdentity[] => {
  const counters: ManagedOperationCounterIdentity[] = [
    {
      ownerKey: GLOBAL_USAGE_OWNER_KEY,
      metricId: LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID,
      periodKey: operation.dailyPeriodKey,
      epoch: operation.epoch,
    },
  ]
  if (operation.userLimitsApplied) {
    const ownerKey = `user:${operation.userId}`
    counters.push(
      {
        ownerKey,
        metricId: LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID,
        periodKey: operation.dailyPeriodKey,
        epoch: operation.epoch,
      },
      {
        ownerKey,
        metricId: LYNVO_PLUGIN_SERVER_MONTHLY_METRIC_ID,
        periodKey: operation.monthlyPeriodKey,
        epoch: operation.epoch,
      }
    )
  }
  return counters
}

const createAtomicCounterRefundStatement = (
  database: D1Database,
  operation: ManagedOperationRecord
): D1PreparedStatement => {
  const counters = getManagedOperationCounterIdentities(operation)
  const counterValuesSql = counters
    .map((_, counterIndex) => {
      const firstBindingIndex = counterIndex * 4 + 1
      return `(?${firstBindingIndex}, ?${firstBindingIndex + 1}, ?${firstBindingIndex + 2}, ?${firstBindingIndex + 3})`
    })
    .join(", ")
  const operationUserIdBindingIndex = counters.length * 4 + 1
  const operationIdBindingIndex = operationUserIdBindingIndex + 1
  const counterBindings = counters.flatMap((counter) => [
    counter.ownerKey,
    counter.metricId,
    counter.periodKey,
    counter.epoch,
  ])
  return database
    .prepare(
      `WITH required_counters(owner_key, metric_id, period_key, epoch) AS (
         VALUES ${counterValuesSql}
       )
       UPDATE usage_counters
       SET used = used - 1
       WHERE EXISTS (
         SELECT 1 FROM required_counters
         WHERE required_counters.owner_key = usage_counters.owner_key
           AND required_counters.metric_id = usage_counters.metric_id
           AND required_counters.period_key = usage_counters.period_key
           AND required_counters.epoch = usage_counters.epoch
       )
       AND NOT EXISTS (
         SELECT 1 FROM required_counters
         LEFT JOIN usage_counters AS current_counters
           ON current_counters.owner_key = required_counters.owner_key
           AND current_counters.metric_id = required_counters.metric_id
           AND current_counters.period_key = required_counters.period_key
           AND current_counters.epoch = required_counters.epoch
         WHERE current_counters.used IS NULL OR current_counters.used <= 0
       )
       AND EXISTS (
         SELECT 1 FROM managed_extraction_operations
         WHERE user_id = ?${operationUserIdBindingIndex}
           AND operation_id = ?${operationIdBindingIndex}
           AND state = 'reserved'
       )`
    )
    .bind(...counterBindings, operation.userId, operation.operationId)
}

const createExpiredManagedExtractionStatements = (
  database: D1Database,
  operation: ManagedOperationRecord,
  now: number
): readonly D1PreparedStatement[] => [
  createAtomicCounterRefundStatement(database, operation),
  database
    .prepare(
      "UPDATE managed_extraction_operations SET state = 'released', settled_at = ?3 WHERE user_id = ?1 AND operation_id = ?2 AND state = 'reserved'"
    )
    .bind(operation.userId, operation.operationId, now),
]

export type ManagedExtractionReservationResult =
  | { status: "already-reserved"; dataVersion: number }
  | {
      status: "reserved"
      dailyUsed: number
      monthlyUsed: number
      dataVersion: number
    }

interface ManagedExtractionReservationInput {
  operationId: string
  pluginId: ManagedPluginId
  usageLimitsDisabled?: boolean | undefined
  now: number
}

interface ManagedExtractionUsageSnapshot {
  daily: UsagePeriod
  monthly: UsagePeriod
  epoch: number
  ownerKey: string
  userDailyUsed: number | null
  globalDailyUsed: number | null
  monthlyUsedBefore: number | null
}

interface BuildManagedExtractionReservationInput {
  database: D1Database
  userId: string
  input: ManagedExtractionReservationInput
  usageLimitsDisabled: boolean
  snapshot: ManagedExtractionUsageSnapshot
}

interface ReservationCounterRow {
  used: number
}

interface RequireReservationCounterInput {
  row: ReservationCounterRow | undefined
  compensate: () => Promise<void>
  message: string
  resetsAt: number
  now: number
}

interface FinalizeManagedExtractionReservationInput {
  dataVersion: number
  statementResultsAt: (index: number) => ReservationCounterRow | undefined
  compensate: () => Promise<void>
  usageLimitsDisabled: boolean
  daily: UsagePeriod
  monthly: UsagePeriod
  userDailyUsed: number | null
  monthlyUsedBefore: number | null
  now: number
}

const readManagedExtractionUsage = async (
  database: D1Database,
  userId: string,
  now: number
): Promise<ManagedExtractionUsageSnapshot> => {
  const daily = getDailyPeriod(now)
  const monthly = getMonthlyPeriod(now)
  const epoch = await getEpoch(database)
  const ownerKey = `user:${userId}`
  const [userDailyUsed, globalDailyUsed, monthlyUsedBefore] = await Promise.all(
    [
      readCounterValue({
        database,
        ownerKey,
        metricId: LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID,
        periodKey: daily.key,
        epoch,
      }),
      readCounterValue({
        database,
        ownerKey: GLOBAL_USAGE_OWNER_KEY,
        metricId: LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID,
        periodKey: daily.key,
        epoch,
      }),
      readCounterValue({
        database,
        ownerKey,
        metricId: LYNVO_PLUGIN_SERVER_MONTHLY_METRIC_ID,
        periodKey: monthly.key,
        epoch,
      }),
    ]
  )
  return {
    daily,
    monthly,
    epoch,
    ownerKey,
    userDailyUsed,
    globalDailyUsed,
    monthlyUsedBefore,
  }
}

const assertManagedExtractionWithinLimits = (
  usageLimitsDisabled: boolean,
  snapshot: ManagedExtractionUsageSnapshot,
  now: number
): void => {
  if (
    !usageLimitsDisabled &&
    (snapshot.userDailyUsed ?? 0) >= USER_DAILY_LYNVO_PLUGIN_EXTRACTION_LIMIT
  ) {
    throw new UsageLimitExhaustedError(
      "Daily Lynvo Plugin extraction limit reached.",
      snapshot.daily.resetsAt,
      now
    )
  }
  if (
    (snapshot.globalDailyUsed ?? 0) >=
    GLOBAL_DAILY_LYNVO_PLUGIN_EXTRACTION_LIMIT
  ) {
    throw new UsageLimitExhaustedError(
      "Lynvo Plugin extraction capacity is unavailable until tomorrow.",
      snapshot.daily.resetsAt,
      now
    )
  }
  if (
    !usageLimitsDisabled &&
    (snapshot.monthlyUsedBefore ?? 0) >=
      USER_MONTHLY_LYNVO_PLUGIN_EXTRACTION_LIMIT
  ) {
    throw new UsageLimitExhaustedError(
      "Monthly Lynvo Plugin extraction limit reached.",
      snapshot.monthly.resetsAt,
      now
    )
  }
}

const buildManagedExtractionReservationStatements = ({
  database,
  userId,
  input,
  usageLimitsDisabled,
  snapshot,
}: BuildManagedExtractionReservationInput): D1PreparedStatement[] => {
  const { daily, monthly, epoch, ownerKey } = snapshot
  return [
    ...(usageLimitsDisabled
      ? []
      : [
          incrementCounterStatement(database, {
            ownerKey,
            metricId: LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID,
            periodKey: daily.key,
            epoch,
            limit: USER_DAILY_LYNVO_PLUGIN_EXTRACTION_LIMIT,
          }),
          incrementCounterStatement(database, {
            ownerKey,
            metricId: LYNVO_PLUGIN_SERVER_MONTHLY_METRIC_ID,
            periodKey: monthly.key,
            epoch,
            limit: USER_MONTHLY_LYNVO_PLUGIN_EXTRACTION_LIMIT,
          }),
        ]),
    incrementCounterStatement(database, {
      ownerKey: GLOBAL_USAGE_OWNER_KEY,
      metricId: LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID,
      periodKey: daily.key,
      epoch,
      limit: GLOBAL_DAILY_LYNVO_PLUGIN_EXTRACTION_LIMIT,
    }),
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
      ),
  ]
}

const requireReservationCounter = async ({
  row,
  compensate,
  message,
  resetsAt,
  now,
}: RequireReservationCounterInput): Promise<number> => {
  if (!row) {
    await compensate()
    throw new UsageLimitExhaustedError(message, resetsAt, now)
  }
  return row.used
}

const finalizeManagedExtractionReservation = async ({
  dataVersion,
  statementResultsAt,
  compensate,
  usageLimitsDisabled,
  daily,
  monthly,
  userDailyUsed,
  monthlyUsedBefore,
  now,
}: FinalizeManagedExtractionReservationInput): Promise<ManagedExtractionReservationResult> => {
  if (!usageLimitsDisabled) {
    const dailyUsed = await requireReservationCounter({
      row: statementResultsAt(0),
      compensate,
      message: "Daily Lynvo Plugin extraction limit reached.",
      resetsAt: daily.resetsAt,
      now,
    })
    const monthlyUsed = await requireReservationCounter({
      row: statementResultsAt(1),
      compensate,
      message: "Monthly Lynvo Plugin extraction limit reached.",
      resetsAt: monthly.resetsAt,
      now,
    })
    await requireReservationCounter({
      row: statementResultsAt(2),
      compensate,
      message:
        "Lynvo Plugin extraction capacity is unavailable until tomorrow.",
      resetsAt: daily.resetsAt,
      now,
    })
    return { status: "reserved", dailyUsed, monthlyUsed, dataVersion }
  }
  await requireReservationCounter({
    row: statementResultsAt(0),
    compensate,
    message: "Lynvo Plugin extraction capacity is unavailable until tomorrow.",
    resetsAt: daily.resetsAt,
    now,
  })
  return {
    status: "reserved",
    dailyUsed: userDailyUsed ?? 0,
    monthlyUsed: monthlyUsedBefore ?? 0,
    dataVersion,
  }
}

export const reserveManagedExtraction = async (
  database: D1Database,
  userId: string,
  input: ManagedExtractionReservationInput
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
  const snapshot = await readManagedExtractionUsage(database, userId, input.now)
  assertManagedExtractionWithinLimits(usageLimitsDisabled, snapshot, input.now)
  const statements = buildManagedExtractionReservationStatements({
    database,
    userId,
    input,
    usageLimitsDisabled,
    snapshot,
  })
  const { dataVersion, statementResults } = await executeOwnedWrite({
    database,
    userId,
    statements,
  })
  // SAFETY: a conditional increment that hit its limit returns no row; the
  // batch still commits, so the sibling statements are compensated below.
  const rowAt = (index: number): { used: number } | undefined =>
    statementResults[index]?.results?.[0] as { used: number } | undefined
  const compensate = () =>
    compensateReservedManagedExtraction(database, {
      userId,
      operationId: input.operationId,
      epoch: snapshot.epoch,
      dailyPeriodKey: snapshot.daily.key,
      monthlyPeriodKey: snapshot.monthly.key,
      userLimitsApplied: !usageLimitsDisabled,
    })
  return finalizeManagedExtractionReservation({
    dataVersion,
    statementResultsAt: rowAt,
    compensate,
    usageLimitsDisabled,
    daily: snapshot.daily,
    monthly: snapshot.monthly,
    userDailyUsed: snapshot.userDailyUsed,
    monthlyUsedBefore: snapshot.monthlyUsedBefore,
    now: input.now,
  })
}

const compensateReservedManagedExtraction = async (
  database: D1Database,
  input: {
    userId: string
    operationId: string
    epoch: number
    dailyPeriodKey: string
    monthlyPeriodKey: string
    userLimitsApplied: boolean
  }
): Promise<void> => {
  const ownerKey = `user:${input.userId}`
  await database.batch([
    decrementCounterStatement(database, {
      ownerKey: GLOBAL_USAGE_OWNER_KEY,
      metricId: LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID,
      periodKey: input.dailyPeriodKey,
      epoch: input.epoch,
      userId: input.userId,
      operationId: input.operationId,
    }),
    ...(input.userLimitsApplied
      ? [
          decrementCounterStatement(database, {
            ownerKey,
            metricId: LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID,
            periodKey: input.dailyPeriodKey,
            epoch: input.epoch,
            userId: input.userId,
            operationId: input.operationId,
          }),
          decrementCounterStatement(database, {
            ownerKey,
            metricId: LYNVO_PLUGIN_SERVER_MONTHLY_METRIC_ID,
            periodKey: input.monthlyPeriodKey,
            epoch: input.epoch,
            userId: input.userId,
            operationId: input.operationId,
          }),
        ]
      : []),
    database
      .prepare(
        "DELETE FROM managed_extraction_operations WHERE user_id = ?1 AND operation_id = ?2 AND state = 'reserved'"
      )
      .bind(input.userId, input.operationId),
  ])
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
      ? [createAtomicCounterRefundStatement(database, operation)]
      : []
  const { dataVersion, statementResults } = await executeOwnedWrite({
    database,
    userId,
    statements: [
      ...releaseStatements,
      database
        .prepare(
          "UPDATE managed_extraction_operations SET state = ?3, settled_at = ?2 WHERE user_id = ?1 AND operation_id = ?4 AND state = 'reserved'"
        )
        .bind(userId, input.now, input.outcome, input.operationId),
    ],
  })
  const settleResult = statementResults[releaseStatements.length]
  if ((settleResult?.meta.changes ?? 0) === 0) {
    return {
      status: "already-settled",
      dataVersion: await getDataVersion(database, userId),
    }
  }
  return { status: input.outcome, dataVersion }
}

export const releaseExpiredManagedExtractions = async (
  database: D1Database,
  now: number
): Promise<{ released: number }> => {
  const operations = await readExpiredManagedOperations(database, now)
  if (operations.length === 0) {
    return { released: 0 }
  }
  const statements = operations.flatMap((operation) =>
    createExpiredManagedExtractionStatements(database, operation, now)
  )
  const affectedUserIds = new Set<string>()
  for (const operation of operations) {
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
    readCounterValue({
      database,
      ownerKey,
      metricId: LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID,
      periodKey: daily.key,
      epoch,
    }),
    readCounterValue({
      database,
      ownerKey,
      metricId: LYNVO_PLUGIN_SERVER_MONTHLY_METRIC_ID,
      periodKey: monthly.key,
      epoch,
    }),
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
