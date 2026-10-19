import {
  CRON_SCHEDULE_DAILY_RETENTION,
  CRON_SCHEDULE_HOURLY_MAINTENANCE,
} from "./constants"
import { drainAccountErasures } from "./d1/account-erasure"
import { getD1Database } from "./d1/db"
import { cleanupExpiredDeviceCodes } from "./d1/device-auth"
import {
  cleanupSavedLinkCommandOperations,
  sweepExpiredLinks,
} from "./d1/links"
import { expireStalePluginServerRegistrations } from "./d1/plugin-servers"
import { cleanupExpiredRemoteCommands } from "./d1/remote-commands"
import { deleteStaleSessions } from "./d1/sessions"
import { releaseExpiredManagedExtractions } from "./d1/usage"
import { processQueuedLinkExtractions } from "./link-extraction-runner"
import { refreshCustomPluginServerManifests } from "./plugin-server-manifest-refresh"
import { createRemoteCommandNotificationDelivery } from "./remote-command-notification-delivery"

const toFailureMessage = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

const sweepD1AuthData = async (
  database: D1Database
): Promise<{ kind: "swept" } | { kind: "unavailable" }> => {
  try {
    const now = Date.now()
    const [deletedSessions, deletedDeviceCodes] = await Promise.all([
      deleteStaleSessions(database, now),
      cleanupExpiredDeviceCodes(database, now),
    ])
    console.info("d1_auth_sweep", {
      operation: "d1_auth_sweep",
      deleted_sessions: deletedSessions,
      deleted_device_codes: deletedDeviceCodes.deleted,
    })
    return { kind: "swept" }
  } catch (error) {
    console.error("d1_auth_sweep_failed", {
      operation: "d1_auth_sweep",
      error: error instanceof Error ? error.message : String(error),
    })
    return { kind: "unavailable" }
  }
}

type MaintenanceOutcome = { kind: "swept" } | { kind: "unavailable" }

interface D1MaintenanceSummary {
  readonly job: string
  readonly deletedCount: number
}

const sweepLinkCommandOperationsJob = async (
  database: D1Database,
  now: number
): Promise<D1MaintenanceSummary> => ({
  job: "link_command_operations_ttl",
  deletedCount: (await cleanupSavedLinkCommandOperations(database, now))
    .deleted,
})

const expirePluginServerRegistrationsJob = async (
  database: D1Database,
  now: number,
  realtime: DurableObjectNamespace
): Promise<D1MaintenanceSummary> => ({
  job: "plugin_server_registration_expiry",
  deletedCount: (
    await expireStalePluginServerRegistrations(database, now, realtime)
  ).expired,
})

const sweepRetainedLinksJob = async (
  database: D1Database,
  now: number,
  realtime: DurableObjectNamespace
): Promise<D1MaintenanceSummary> => ({
  job: "links_retention",
  deletedCount: (await sweepExpiredLinks(database, now, realtime)).deletedLinks,
})

const releaseExpiredExtractionsJob = async (
  database: D1Database,
  now: number,
  realtime: DurableObjectNamespace
): Promise<D1MaintenanceSummary> => ({
  job: "managed_extraction_lease_expiry",
  deletedCount: (
    await releaseExpiredManagedExtractions(database, now, realtime)
  ).released,
})

const cleanupRemoteCommandsJob = async (
  database: D1Database,
  now: number
): Promise<D1MaintenanceSummary> => ({
  job: "remote_commands_ttl",
  deletedCount: (await cleanupExpiredRemoteCommands(database, now))
    .deletedCount,
})

const drainPendingAccountErasuresJob = async (
  database: D1Database
): Promise<MaintenanceOutcome> => {
  try {
    const outcome = await drainAccountErasures(database)
    console.info("account_erasure_drain", {
      operation: "account_erasure_drain",
      processed_users: outcome.processedUsers,
      steps_exhausted: outcome.stepsExhausted,
    })
    return { kind: "swept" }
  } catch (error) {
    console.error("account_erasure_drain_failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    return { kind: "unavailable" }
  }
}

const runD1Maintenance = async (
  maintenance: (now: number) => Promise<D1MaintenanceSummary>
): Promise<MaintenanceOutcome> => {
  try {
    const summary = await maintenance(Date.now())
    console.info("d1_maintenance", {
      operation: summary.job,
      deleted_count: summary.deletedCount,
    })
    return { kind: "swept" }
  } catch (error) {
    console.error("d1_maintenance_failed", {
      error: error instanceof Error ? error.message : String(error),
    })
    return { kind: "unavailable" }
  }
}

const runHourlyD1Maintenance = async (
  database: D1Database,
  realtime: DurableObjectNamespace
): Promise<MaintenanceOutcome[]> =>
  Promise.all([
    runD1Maintenance((now) =>
      expirePluginServerRegistrationsJob(database, now, realtime)
    ),
    drainPendingAccountErasuresJob(database),
  ])

const runDailyD1Maintenance = async (
  database: D1Database,
  realtime: DurableObjectNamespace
): Promise<MaintenanceOutcome> =>
  runD1Maintenance((now) => sweepRetainedLinksJob(database, now, realtime))

const runHighFrequencyD1Maintenance = async (
  database: D1Database,
  realtime: DurableObjectNamespace
): Promise<MaintenanceOutcome[]> =>
  Promise.all([
    runD1Maintenance((now) =>
      releaseExpiredExtractionsJob(database, now, realtime)
    ),
    runD1Maintenance((now) => cleanupRemoteCommandsJob(database, now)),
    runD1Maintenance((now) => sweepLinkCommandOperationsJob(database, now)),
  ])
interface ScheduledMaintenanceCronInput {
  env: Env
  database: ReturnType<typeof getD1Database>
  startedAt: number
}

const runHourlyMaintenanceCron = async ({
  env,
  database,
  startedAt,
}: ScheduledMaintenanceCronInput): Promise<void> => {
  const manifestRefresh = database
    ? await refreshCustomPluginServerManifests(env, database).catch((error) => {
        console.warn("plugin_server_manifest_refresh_unavailable", {
          operation: "plugin_server_manifest_refresh_unavailable",
          error: error instanceof Error ? error.message : String(error),
        })
        return { refreshed: 0, failed: 0 }
      })
    : { refreshed: 0, failed: 0 }
  console.info("plugin_server_manifest_refresh", {
    operation: "plugin_server_manifest_refresh",
    refreshed_count: manifestRefresh.refreshed,
    failed_count: manifestRefresh.failed,
  })
  const outcomes = database
    ? await runHourlyD1Maintenance(database, env.USER_REALTIME_ROOM)
    : []
  const failed = outcomes.some((outcome) => outcome.kind === "unavailable")
  console.info("scheduled_hourly_maintenance", {
    operation: "scheduled_hourly_maintenance",
    outcome: failed ? "failure" : "success",
    duration_ms: Math.max(0, performance.now() - startedAt),
  })
  if (failed) {
    throw new Error("D1 hourly maintenance is unavailable")
  }
}

interface ScheduledRetentionCronInput {
  env: Env
  database: ReturnType<typeof getD1Database>
  startedAt: number
}

const runDailyRetentionCron = async ({
  env,
  database,
  startedAt,
}: ScheduledRetentionCronInput): Promise<void> => {
  const outcome = database
    ? await runDailyD1Maintenance(database, env.USER_REALTIME_ROOM)
    : { kind: "skipped" as const }
  const failed = outcome.kind === "unavailable"
  console.info("scheduled_daily_retention", {
    operation: "scheduled_daily_retention",
    outcome: failed ? "failure" : "success",
    duration_ms: Math.max(0, performance.now() - startedAt),
  })
  if (failed) {
    throw new Error("D1 daily retention maintenance is unavailable")
  }
}

export const scheduled = async (
  controller: ScheduledController,
  env: Env
): Promise<void> => {
  const startedAt = performance.now()
  const database = getD1Database(env)
  if (controller.cron === CRON_SCHEDULE_HOURLY_MAINTENANCE) {
    await runHourlyMaintenanceCron({ env, database, startedAt })
    return
  }
  if (controller.cron === CRON_SCHEDULE_DAILY_RETENTION) {
    await runDailyRetentionCron({ env, database, startedAt })
    return
  }
  // A rejection in any branch must not skip the outcome logging of the
  // others, so each branch carries its own catch.
  const [notificationResult, d1SweepOutcome, d1MaintenanceOutcomes] =
    await Promise.all([
      createRemoteCommandNotificationDelivery(env, database)
        .drain()
        .catch((cause: unknown) => {
          console.error("remote_command_drain_failed", {
            operation: "remote_command_drain_failed",
            error: toFailureMessage(cause),
          })
          return { kind: "unavailable" as const }
        }),
      database
        ? sweepD1AuthData(database)
        : Promise.resolve({ kind: "skipped" as const }),
      database
        ? runHighFrequencyD1Maintenance(database, env.USER_REALTIME_ROOM)
        : Promise.resolve<MaintenanceOutcome[]>([]),
      database
        ? processQueuedLinkExtractions(env, database).catch(
            (cause: unknown) => {
              console.error("queued_extraction_drain_failed", {
                operation: "queued_extraction_drain_failed",
                error: toFailureMessage(cause),
              })
            }
          )
        : Promise.resolve(),
    ])
  const unavailable = d1MaintenanceOutcomes.filter(
    (outcome) => outcome.kind === "unavailable"
  ).length
  console.info("scheduled_delivery_drain", {
    operation: "scheduled_delivery_drain",
    outcome:
      notificationResult.kind === "unavailable" ||
      d1SweepOutcome.kind === "unavailable" ||
      unavailable > 0
        ? "failure"
        : "success",
    unavailable,
    d1_sweep: d1SweepOutcome.kind,
    duration_ms: Math.max(0, performance.now() - startedAt),
  })
  if (
    notificationResult.kind === "unavailable" ||
    d1SweepOutcome.kind === "unavailable" ||
    unavailable > 0
  ) {
    throw new Error("Scheduled maintenance drain failed")
  }
}
