import { env, runInDurableObject } from "cloudflare:test"
import { beforeEach, describe, expect, it } from "vitest"
import {
  GLOBAL_DAILY_OPERATION_LIMIT,
  USAGE_LIMITER_NAME,
} from "../src/constants"
import type { OfficialExtractorUsageLimiter } from "../src/usage-limiter"

const getStub = (): DurableObjectStub => {
  const namespace = env.OFFICIAL_EXTRACTOR_USAGE_LIMITER
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
    const timestampMs = Date.UTC(2026, 6, 19)
    const usage = await requestAt("/usage", timestampMs)
    const body = await usage.json<{ metrics: Array<{ used: number }> }>()
    for (let index = 0; index < body.metrics[0].used; index += 1) {
      await requestAt("/settle", timestampMs, {
        method: "POST",
        body: JSON.stringify({ succeeded: false }),
      })
    }
  })

  it("reserves concurrent capacity without losing increments", async () => {
    const timestampMs = Date.UTC(2026, 6, 19)
    const reservations = await Promise.all(
      Array.from({ length: 20 }, () =>
        requestAt("/reserve", timestampMs, { method: "POST" })
      )
    )
    expect(
      await Promise.all(
        reservations.map((response) => response.json<{ reserved: boolean }>())
      )
    ).toEqual(Array.from({ length: 20 }, () => ({ reserved: true })))

    const response = await requestAt("/usage", timestampMs)
    const usage = await response.json<{ metrics: Array<{ used: number }> }>()
    expect(usage.metrics[0].used).toBe(20)
  })

  it("releases failed reservations", async () => {
    const timestampMs = Date.UTC(2026, 6, 19)
    await requestAt("/reserve", timestampMs, { method: "POST" })
    await requestAt("/settle", timestampMs, {
      method: "POST",
      body: JSON.stringify({ succeeded: false }),
    })
    const response = await requestAt("/usage", timestampMs)
    const usage = await response.json<{ metrics: Array<{ used: number }> }>()
    expect(usage.metrics[0].used).toBe(0)
  })

  it("rejects reservations at the finite limit", async () => {
    const timestampMs = Date.UTC(2026, 6, 19)
    const periodKey = "2026-07-19"
    const stub = getStub()
    await runInDurableObject<OfficialExtractorUsageLimiter, void>(
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
    expect(await response.json()).toEqual({ reserved: false })
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
})
