import { executeOwnedWrite } from "./data-version"
import {
  LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID,
  LYNVO_PLUGIN_SERVER_MONTHLY_METRIC_ID,
} from "./usage"

export const resetDocsSeedManagedUsage = async (
  database: D1Database,
  userId: string,
  fixtureOperationId: string
): Promise<void> => {
  await executeOwnedWrite({
    database,
    userId,
    statements: [
      database
        .prepare(
          `UPDATE usage_counters
           SET used = MAX(0, used - (
             SELECT COUNT(*) FROM managed_extraction_operations
             WHERE user_id = ?1 AND operation_id <> ?2
               AND state IN ('reserved', 'consumed')
               AND epoch = usage_counters.epoch
               AND daily_period_key = usage_counters.period_key
           ))
           WHERE owner_key = 'global'
             AND metric_id = ?3
             AND EXISTS (
               SELECT 1 FROM managed_extraction_operations
               WHERE user_id = ?1 AND operation_id <> ?2
                 AND state IN ('reserved', 'consumed')
                 AND epoch = usage_counters.epoch
                 AND daily_period_key = usage_counters.period_key
             )`
        )
        .bind(userId, fixtureOperationId, LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID),
      database
        .prepare(
          `DELETE FROM usage_counters
           WHERE owner_key = ?1 AND metric_id IN (?2, ?3)`
        )
        .bind(
          `user:${userId}`,
          LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID,
          LYNVO_PLUGIN_SERVER_MONTHLY_METRIC_ID
        ),
      database
        .prepare(
          `DELETE FROM managed_extraction_operations
           WHERE user_id = ?1 AND (operation_id <> ?2 OR state = 'released')`
        )
        .bind(userId, fixtureOperationId),
      database
        .prepare(
          `INSERT INTO usage_counters (owner_key, metric_id, period_key, epoch, used)
           SELECT 'user:' || user_id, ?3, daily_period_key, epoch, 1
           FROM managed_extraction_operations
           WHERE user_id = ?1 AND operation_id = ?2
             AND state IN ('reserved', 'consumed') AND user_limits_applied = 1
           ON CONFLICT(owner_key, metric_id, period_key, epoch)
           DO UPDATE SET used = 1`
        )
        .bind(userId, fixtureOperationId, LYNVO_PLUGIN_SERVER_DAILY_METRIC_ID),
      database
        .prepare(
          `INSERT INTO usage_counters (owner_key, metric_id, period_key, epoch, used)
           SELECT 'user:' || user_id, ?3, monthly_period_key, epoch, 1
           FROM managed_extraction_operations
           WHERE user_id = ?1 AND operation_id = ?2
             AND state IN ('reserved', 'consumed') AND user_limits_applied = 1
           ON CONFLICT(owner_key, metric_id, period_key, epoch)
           DO UPDATE SET used = 1`
        )
        .bind(
          userId,
          fixtureOperationId,
          LYNVO_PLUGIN_SERVER_MONTHLY_METRIC_ID
        ),
    ],
  })
}
