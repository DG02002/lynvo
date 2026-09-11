import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  GLOBAL_DAILY_OPERATION_LIMIT,
  USAGE_RESERVATION_LEASE_MS,
  USAGE_RESERVATION_SETTLEMENT_GRACE_MS,
} from "../src/constants"
import { usagePeriodForTesting } from "../src/usage-limiter"
import {
  getUsageLimiterStub,
  runInUsageLimiter,
  setUsageCounters,
} from "./usage-limiter-test-helpers"

const requestAt = (
  path: string,
  timestampMs: number,
  init?: RequestInit
): Promise<Response> =>
  getUsageLimiterStub().fetch(`https://usage.internal${path}`, {
    ...init,
    headers: { "x-lynvo-now-ms": String(timestampMs), ...init?.headers },
  })

describe("usage limiter", () => {
  beforeEach(async () => {
    await runInUsageLimiter(async (_instance, state) => {
      await state.storage.deleteAlarm()
      state.storage.sql.exec("DELETE FROM usage_counters")
      state.storage.sql.exec("DELETE FROM usage_reservations")
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("reserves concurrent capacity without losing increments", async () => {
    const timestampMs = Date.UTC(2100, 6, 19)
    const reservations = await Promise.all(
      Array.from({ length: 20 }, () =>
        requestAt("/reserve", timestampMs, { method: "POST" })
      )
    )
    const results = await Promise.all(
      reservations.map((response) =>
        response.json<{
          reserved: boolean
          periodKey: string
          reservationId: string | null
        }>()
      )
    )
    expect(results.every((result) => result.reserved)).toBe(true)
    expect(new Set(results.map((result) => result.reservationId)).size).toBe(20)

    const response = await requestAt("/usage", timestampMs)
    const usage = await response.json<{ metrics: Array<{ used: number }> }>()
    expect(usage.metrics[0].used).toBe(20)
  })

  it("releases failed reservations", async () => {
    const timestampMs = Date.UTC(2100, 6, 19)
    const reservationResponse = await requestAt("/reserve", timestampMs, {
      method: "POST",
    })
    const reservation = await reservationResponse.json<{
      reservationId: string
    }>()
    await requestAt("/settle", timestampMs, {
      method: "POST",
      body: JSON.stringify({
        succeeded: false,
        reservationId: reservation.reservationId,
      }),
    })
    const response = await requestAt("/usage", timestampMs)
    const usage = await response.json<{ metrics: Array<{ used: number }> }>()
    expect(usage.metrics[0].used).toBe(0)
  })

  it("releases a failed reservation from its original UTC period", async () => {
    const beforeMidnight = Date.UTC(2100, 6, 19, 23, 59, 59)
    const afterMidnight = Date.UTC(2100, 6, 20, 0, 0, 1)
    const reservationResponse = await requestAt("/reserve", beforeMidnight, {
      method: "POST",
    })
    const reservation = await reservationResponse.json<{
      reserved: boolean
      periodKey: string
      reservationId: string
    }>()

    expect(reservation).toMatchObject({
      reserved: true,
      periodKey: "2100-07-19",
    })
    await requestAt("/settle", afterMidnight, {
      method: "POST",
      body: JSON.stringify({
        succeeded: false,
        reservationId: reservation.reservationId,
      }),
    })

    const originalPeriodResponse = await requestAt("/usage", beforeMidnight)
    const originalPeriod = await originalPeriodResponse.json<{
      metrics: Array<{ used: number }>
    }>()
    expect(originalPeriod.metrics[0].used).toBe(0)
  })

  it.each([
    {
      name: "at the finite limit",
      timestampMs: Date.UTC(2100, 6, 19),
      expectedPeriodKey: "2100-07-19",
      expectedRetryAfterSeconds: 86_400,
    },
    {
      name: "with a partial reset interval",
      timestampMs: Date.UTC(2100, 6, 19, 23, 59, 59, 250),
      expectedPeriodKey: "2100-07-19",
      expectedRetryAfterSeconds: 1,
    },
  ])(
    "rejects reservations $name",
    async ({ timestampMs, expectedPeriodKey, expectedRetryAfterSeconds }) => {
      const seededPeriodKey =
        usagePeriodForTesting.currentPeriodKey(timestampMs)
      await setUsageCounters([seededPeriodKey], GLOBAL_DAILY_OPERATION_LIMIT)

      const response = await requestAt("/reserve", timestampMs, {
        method: "POST",
      })
      expect(await response.json()).toEqual({
        reserved: false,
        periodKey: expectedPeriodKey,
        reservationId: null,
        retryAfterSeconds: expectedRetryAfterSeconds,
      })
    }
  )

  it("uses independent UTC daily periods", async () => {
    const firstDay = Date.UTC(2100, 6, 19, 23, 59)
    const secondDay = Date.UTC(2100, 6, 20)
    await requestAt("/reserve", firstDay, { method: "POST" })

    const response = await requestAt("/usage", secondDay)
    const usage = await response.json<{
      metrics: Array<{ used: number; resetsAt: string }>
    }>()
    expect(usage.metrics[0].used).toBe(0)
    expect(usage.metrics[0].resetsAt).toBe("2100-07-21T00:00:00.000Z")
  })

  it("settles duplicate requests exactly once", async () => {
    const timestampMs = Date.UTC(2100, 6, 19)
    const reservationResponse = await requestAt("/reserve", timestampMs, {
      method: "POST",
    })
    const reservation = await reservationResponse.json<{
      reservationId: string
    }>()
    const settlement = {
      method: "POST",
      body: JSON.stringify({
        succeeded: true,
        reservationId: reservation.reservationId,
      }),
    }
    await requestAt("/settle", timestampMs, settlement)
    await requestAt("/settle", timestampMs, settlement)

    const usageResponse = await requestAt("/usage", timestampMs)
    const usage = await usageResponse.json<{
      metrics: Array<{ used: number }>
    }>()
    expect(usage.metrics[0]?.used).toBe(1)
  })

  it("reclaims an abandoned reservation through the alarm", async () => {
    vi.useFakeTimers()
    const timestampMs = Date.UTC(2100, 6, 19)
    vi.setSystemTime(timestampMs)
    await requestAt("/reserve", timestampMs, { method: "POST" })
    vi.setSystemTime(timestampMs + USAGE_RESERVATION_LEASE_MS)
    await runInUsageLimiter(async (instance) => {
      await instance.alarm()
    })

    const usageResponse = await requestAt(
      "/usage",
      timestampMs + USAGE_RESERVATION_LEASE_MS
    )
    const usage = await usageResponse.json<{
      metrics: Array<{ used: number }>
    }>()
    expect(usage.metrics[0]?.used).toBe(1)

    vi.setSystemTime(
      timestampMs +
        USAGE_RESERVATION_LEASE_MS +
        USAGE_RESERVATION_SETTLEMENT_GRACE_MS
    )
    await runInUsageLimiter(async (instance) => {
      await instance.alarm()
    })
    const reclaimedResponse = await requestAt(
      "/usage",
      timestampMs +
        USAGE_RESERVATION_LEASE_MS +
        USAGE_RESERVATION_SETTLEMENT_GRACE_MS
    )
    const reclaimed = await reclaimedResponse.json<{
      metrics: Array<{ used: number }>
    }>()
    expect(reclaimed.metrics[0]?.used).toBe(0)
  })

  it("does not postpone the earliest alarm when later work arrives", async () => {
    const timestampMs = Date.UTC(2101, 6, 19)
    await requestAt("/reserve", timestampMs, { method: "POST" })
    const firstAlarm = await runInUsageLimiter((_instance, state) =>
      state.storage.getAlarm()
    )

    await requestAt("/reserve", timestampMs + 60_000, { method: "POST" })
    const secondAlarm = await runInUsageLimiter((_instance, state) =>
      state.storage.getAlarm()
    )

    expect(firstAlarm).toBe(timestampMs + USAGE_RESERVATION_LEASE_MS)
    expect(secondAlarm).toBe(firstAlarm)
  })
})
