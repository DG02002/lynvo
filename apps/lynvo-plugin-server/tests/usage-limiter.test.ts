import { env, runInDurableObject } from "cloudflare:test"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  GLOBAL_DAILY_OPERATION_LIMIT,
  USAGE_RESERVATION_LEASE_MS,
  USAGE_RESERVATION_SETTLEMENT_GRACE_MS,
  USAGE_LIMITER_NAME,
} from "../src/constants"
import type { LynvoPluginServerUsageLimiter } from "../src/usage-limiter"

const getStub = (): DurableObjectStub => {
  const namespace = env.LYNVO_PLUGIN_SERVER_USAGE_LIMITER
  const id = namespace.idFromName(USAGE_LIMITER_NAME)
  return namespace.get(id)
}

const requestAt = (
  path: string,
  timestampMs: number,
  init?: RequestInit
): Promise<Response> =>
  getStub().fetch(`https://usage.internal${path}`, {
    ...init,
    headers: { "x-lynvo-now-ms": String(timestampMs), ...init?.headers },
  })

describe("usage limiter", () => {
  beforeEach(async () => {
    await runInDurableObject<LynvoPluginServerUsageLimiter, void>(
      getStub(),
      (_instance, state) => {
        state.storage.sql.exec("DELETE FROM usage_counters")
        state.storage.sql.exec("DELETE FROM usage_reservations")
      }
    )
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("reserves concurrent capacity without losing increments", async () => {
    const timestampMs = Date.UTC(2026, 6, 19)
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
    const timestampMs = Date.UTC(2026, 6, 19)
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
    const beforeMidnight = Date.UTC(2026, 6, 19, 23, 59, 59)
    const afterMidnight = Date.UTC(2026, 6, 20, 0, 0, 1)
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
      periodKey: "2026-07-19",
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

  it("rejects reservations at the finite limit", async () => {
    const timestampMs = Date.UTC(2026, 6, 19)
    const periodKey = "2026-07-19"
    const stub = getStub()
    await runInDurableObject<LynvoPluginServerUsageLimiter, void>(
      stub,
      (_instance, state) => {
        state.storage.sql.exec(
          "INSERT INTO usage_counters (period_key, used) VALUES (?, ?) ON CONFLICT(period_key) DO UPDATE SET used = excluded.used",
          periodKey,
          GLOBAL_DAILY_OPERATION_LIMIT
        )
      }
    )

    const response = await requestAt("/reserve", timestampMs, {
      method: "POST",
    })
    expect(await response.json()).toEqual({
      reserved: false,
      periodKey: "2026-07-19",
      reservationId: null,
    })
  })

  it("uses independent UTC daily periods", async () => {
    const firstDay = Date.UTC(2026, 6, 19, 23, 59)
    const secondDay = Date.UTC(2026, 6, 20)
    await requestAt("/reserve", firstDay, { method: "POST" })

    const response = await requestAt("/usage", secondDay)
    const usage = await response.json<{
      metrics: Array<{ used: number; resetsAt: string }>
    }>()
    expect(usage.metrics[0].used).toBe(0)
    expect(usage.metrics[0].resetsAt).toBe("2026-07-21T00:00:00.000Z")
  })

  it("settles duplicate requests exactly once", async () => {
    const timestampMs = Date.UTC(2026, 6, 19)
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
    const timestampMs = Date.UTC(2026, 6, 19)
    vi.setSystemTime(timestampMs)
    await requestAt("/reserve", timestampMs, { method: "POST" })
    vi.setSystemTime(timestampMs + USAGE_RESERVATION_LEASE_MS)
    await runInDurableObject<LynvoPluginServerUsageLimiter, void>(
      getStub(),
      async (instance) => {
        await instance.alarm()
      }
    )

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
    await runInDurableObject<LynvoPluginServerUsageLimiter, void>(
      getStub(),
      async (instance) => {
        await instance.alarm()
      }
    )
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
})
