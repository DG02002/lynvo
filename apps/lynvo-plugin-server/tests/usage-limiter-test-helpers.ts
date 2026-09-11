import { env, runInDurableObject } from "cloudflare:test"
import { USAGE_LIMITER_NAME } from "../src/constants"
import {
  usagePeriodForTesting,
  type LynvoPluginServerUsageLimiter,
} from "../src/usage-limiter"

type UsagePeriodKey = string
type UsagePeriodKeys = readonly [UsagePeriodKey, UsagePeriodKey]

export const getUsageLimiterStub = (): DurableObjectStub => {
  const namespace = env.LYNVO_PLUGIN_SERVER_USAGE_LIMITER
  const id = namespace.idFromName(USAGE_LIMITER_NAME)
  return namespace.get(id)
}

export const runInUsageLimiter = <Value>(
  callback: (
    instance: LynvoPluginServerUsageLimiter,
    state: DurableObjectState
  ) => Value | Promise<Value>
): Promise<Value> =>
  runInDurableObject<LynvoPluginServerUsageLimiter, Value>(
    getUsageLimiterStub(),
    callback
  )

// The public route uses live Date.now(), so seed both sides of a possible UTC
// midnight rollover between setup and the request.
export const currentUsagePeriodKeys = (): UsagePeriodKeys => {
  const timestampMs = Date.now()
  return [
    usagePeriodForTesting.currentPeriodKey(timestampMs),
    usagePeriodForTesting.currentPeriodKey(
      timestampMs + usagePeriodForTesting.millisecondsPerDay
    ),
  ]
}

export const setUsageCounters = (
  periodKeys: readonly UsagePeriodKey[],
  used: number
): Promise<void> =>
  runInUsageLimiter((_instance, state) => {
    for (const periodKey of periodKeys) {
      state.storage.sql.exec(
        "INSERT INTO usage_counters (period_key, used) VALUES (?, ?) ON CONFLICT(period_key) DO UPDATE SET used = excluded.used",
        periodKey,
        used
      )
    }
  })

export const clearUsageCounters = (
  periodKeys: readonly UsagePeriodKey[]
): Promise<void> =>
  runInUsageLimiter((_instance, state) => {
    for (const periodKey of periodKeys) {
      state.storage.sql.exec(
        "DELETE FROM usage_counters WHERE period_key = ?",
        periodKey
      )
    }
  })
