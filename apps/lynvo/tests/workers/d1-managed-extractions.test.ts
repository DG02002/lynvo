import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"
import {
  getUsage,
  releaseExpiredManagedExtractions,
  reserveManagedExtraction,
  resetUsageEpoch,
  settleManagedExtraction,
} from "../../workers/d1/usage"
import { insertGoogleUser } from "../../workers/d1/users"

const BASE_NOW = Date.UTC(2026, 7, 18, 0, 0, 0)
const DAY_MS = 24 * 60 * 60 * 1000

const createUser = async () =>
  insertGoogleUser(env.DB, {
    googleSubject: `subject-${crypto.randomUUID()}`,
    email: "usage-test@example.com",
    now: BASE_NOW,
  })

const readUserCounters = async (userId: string) =>
  (
    await env.DB.prepare(
      "SELECT metric_id, period_key, used FROM usage_counters WHERE owner_key = ?1"
    )
      .bind(`user:${userId}`)
      .all<{ metric_id: string; period_key: string; used: number }>()
  ).results

const reserve = (
  userId: string,
  operationId: string,
  pluginId:
    | "bhadoo-google-drive-index"
    | "google-drive-public-files"
    | "onedrive-index"
    | "direct-media",
  now: number
) => reserveManagedExtraction(env.DB, userId, { operationId, pluginId, now })

describe("d1 managed extraction operations", () => {
  it("reserves the same operation once", async () => {
    const user = await createUser()
    const first = await reserve(
      user.id,
      "extract:one",
      "direct-media",
      BASE_NOW
    )
    const retry = await reserve(
      user.id,
      "extract:one",
      "direct-media",
      BASE_NOW
    )
    expect(first).toMatchObject({ status: "reserved", dailyUsed: 1 })
    expect(retry.status).toBe("already-reserved")
    const counters = await readUserCounters(user.id)
    expect(counters).toHaveLength(2)
    expect(counters.every((counter) => counter.used === 1)).toBe(true)
  })

  it("releases pre-execution failures and consumes accepted attempts", async () => {
    const user = await createUser()
    await reserve(user.id, "extract:released", "direct-media", BASE_NOW)
    await settleManagedExtraction(env.DB, user.id, {
      operationId: "extract:released",
      outcome: "released",
      now: BASE_NOW + 1_000,
    })
    await reserve(user.id, "extract:consumed", "direct-media", BASE_NOW)
    await settleManagedExtraction(env.DB, user.id, {
      operationId: "extract:consumed",
      outcome: "consumed",
      now: BASE_NOW + 1_000,
    })
    const counters = await readUserCounters(user.id)
    expect(counters).toHaveLength(2)
    expect(counters.every((counter) => counter.used === 1)).toBe(true)
  })

  it("settles the same reservation idempotently without double refunds", async () => {
    const user = await createUser()
    await reserve(user.id, "extract:double-settle", "direct-media", BASE_NOW)
    const first = await settleManagedExtraction(env.DB, user.id, {
      operationId: "extract:double-settle",
      outcome: "released",
      now: BASE_NOW + 1_000,
    })
    const second = await settleManagedExtraction(env.DB, user.id, {
      operationId: "extract:double-settle",
      outcome: "released",
      now: BASE_NOW + 2_000,
    })
    expect(first.status).toBe("released")
    expect(second.status).toBe("already-settled")
    const usage = await getUsage(env.DB, user.id, BASE_NOW)
    expect(usage.metrics.every((metric) => metric.used === 0)).toBe(true)
  })

  it("isolates inconsistent counters instead of blocking the lease sweep", async () => {
    const healthyUser = await createUser()
    const poisonedUser = await createUser()
    await reserve(healthyUser.id, "sweep:healthy", "direct-media", BASE_NOW)
    await reserve(poisonedUser.id, "sweep:poisoned", "direct-media", BASE_NOW)
    await env.DB.prepare(
      "UPDATE usage_counters SET used = 0 WHERE owner_key = ?1"
    )
      .bind(`user:${poisonedUser.id}`)
      .run()
    const sweepNow = BASE_NOW + 5 * 60 * 1000 + 1_000
    await expect(
      releaseExpiredManagedExtractions(env.DB, sweepNow)
    ).resolves.toMatchObject({ released: expect.any(Number) })
    const healthyUsage = await getUsage(env.DB, healthyUser.id, sweepNow)
    expect(healthyUsage.metrics.every((metric) => metric.used === 0)).toBe(true)
    const poisonedOperation = await env.DB.prepare(
      "SELECT state FROM managed_extraction_operations WHERE user_id = ?1 AND operation_id = 'sweep:poisoned'"
    )
      .bind(poisonedUser.id)
      .first<{ state: string }>()
    expect(poisonedOperation?.state).toBe("released")
  })

  it("shares one 30-operation daily allowance across managed plugins", async () => {
    const user = await createUser()
    const pluginIds = [
      "bhadoo-google-drive-index",
      "google-drive-public-files",
      "onedrive-index",
      "direct-media",
    ] as const
    for (let index = 0; index < 30; index += 1) {
      await reserve(
        user.id,
        `daily:${index}`,
        pluginIds[index % pluginIds.length],
        BASE_NOW
      )
    }
    await expect(
      reserve(user.id, "daily:31", "direct-media", BASE_NOW + 1_000)
    ).rejects.toThrow("Daily Lynvo Plugin extraction limit reached.")
  })

  it("releases an abandoned reservation after its lease expires", async () => {
    const user = await createUser()
    await reserve(user.id, "extract:abandoned", "direct-media", BASE_NOW)
    const sweepNow = BASE_NOW + 5 * 60 * 1000 + 1_000
    const result = await releaseExpiredManagedExtractions(env.DB, sweepNow)
    expect(result.released).toBeGreaterThanOrEqual(1)
    const retry = await reserve(
      user.id,
      "extract:abandoned",
      "direct-media",
      sweepNow
    )
    expect(retry).toMatchObject({ status: "reserved", dailyUsed: 1 })
    const counters = await readUserCounters(user.id)
    expect(counters.every((counter) => counter.used === 1)).toBe(true)
  })

  it("enforces the 200-operation monthly allowance across daily periods", async () => {
    const user = await createUser()
    for (let index = 0; index < 200; index += 1) {
      const dayOffset = Math.floor(index / 30)
      await reserve(
        user.id,
        `monthly:${index}`,
        "direct-media",
        BASE_NOW + dayOffset * DAY_MS + 12 * 60 * 60 * 1000
      )
    }
    await expect(
      reserve(user.id, "monthly:201", "direct-media", BASE_NOW + 7 * DAY_MS)
    ).rejects.toThrow("Monthly Lynvo Plugin extraction limit reached.")
  })

  it("reports usage metrics for the current periods", async () => {
    const user = await createUser()
    await reserve(user.id, "metrics:one", "direct-media", BASE_NOW)
    const usage = await getUsage(env.DB, user.id, BASE_NOW)
    expect(usage.metrics).toHaveLength(2)
    const [dailyMetric, monthlyMetric] = usage.metrics
    expect(dailyMetric?.id).toBe("lynvo-plugin-server-operations")
    expect(dailyMetric?.used).toBe(1)
    expect(dailyMetric?.limit).toBe(30)
    expect(monthlyMetric?.id).toBe("lynvo-plugin-server-extractions")
    expect(monthlyMetric?.used).toBe(1)
    expect(monthlyMetric?.limit).toBe(200)
  })

  it("rotates the usage epoch so stale counters stop applying", async () => {
    const firstReset = await resetUsageEpoch(env.DB, BASE_NOW)
    const secondReset = await resetUsageEpoch(env.DB, BASE_NOW + 1_000)
    expect(secondReset.epoch).toBe(firstReset.epoch + 1)
    const user = await createUser()
    const reservation = await reserve(
      user.id,
      `epoch:${firstReset.epoch}`,
      "direct-media",
      BASE_NOW
    )
    expect(reservation).toMatchObject({ status: "reserved", dailyUsed: 1 })
  })
})
