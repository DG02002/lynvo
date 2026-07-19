import type { UsageResponse } from "@lynvo/extractor-protocol"
import {
  GLOBAL_DAILY_OPERATION_LIMIT,
  MILLISECONDS_PER_DAY,
  USAGE_LIMITER_NAME,
} from "./constants"

export interface UsageCounterRow {
  [column: string]: SqlStorageValue
  used: number
}

export interface UsageReservationResult {
  reserved: boolean
}

const currentPeriodKey = (timestampMs: number): string =>
  new Date(timestampMs).toISOString().slice(0, 10)

const nextResetAt = (timestampMs: number): string => {
  const currentDate = new Date(timestampMs)
  return new Date(
    Date.UTC(
      currentDate.getUTCFullYear(),
      currentDate.getUTCMonth(),
      currentDate.getUTCDate() + 1
    )
  ).toISOString()
}

export class OfficialExtractorUsageLimiter {
  private readonly state: DurableObjectState

  constructor(state: DurableObjectState) {
    this.state = state
    this.state.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS usage_counters (period_key TEXT PRIMARY KEY, used INTEGER NOT NULL)"
    )
  }

  private getUsed(periodKey: string): number {
    const row = this.state.storage.sql
      .exec<UsageCounterRow>(
        "SELECT used FROM usage_counters WHERE period_key = ?",
        periodKey
      )
      .toArray()[0]
    return row?.used ?? 0
  }

  private reserve(periodKey: string): boolean {
    const used = this.getUsed(periodKey)
    if (used >= GLOBAL_DAILY_OPERATION_LIMIT) {
      return false
    }
    this.state.storage.sql.exec(
      "INSERT INTO usage_counters (period_key, used) VALUES (?, 1) ON CONFLICT(period_key) DO UPDATE SET used = used + 1",
      periodKey
    )
    return true
  }

  private release(periodKey: string): void {
    this.state.storage.sql.exec(
      "UPDATE usage_counters SET used = MAX(0, used - 1) WHERE period_key = ?",
      periodKey
    )
  }

  async fetch(request: Request): Promise<Response> {
    const nowHeader = request.headers.get("x-lynvo-now-ms")
    const timestampMs = nowHeader ? Number(nowHeader) : Date.now()
    const periodKey = currentPeriodKey(timestampMs)
    const pathname = new URL(request.url).pathname

    if (pathname === "/reserve" && request.method === "POST") {
      return Response.json({
        reserved: this.reserve(periodKey),
      } satisfies UsageReservationResult)
    }
    if (pathname === "/settle" && request.method === "POST") {
      const body: unknown = await request.json()
      if (
        typeof body === "object" &&
        body !== null &&
        "succeeded" in body &&
        body.succeeded === false
      ) {
        this.release(periodKey)
      }
      return new Response(null, { status: 204 })
    }
    if (pathname === "/usage" && request.method === "GET") {
      const usage: UsageResponse = {
        metrics: [
          {
            id: "official-extractor-operations",
            label: "Official extractor operations",
            used: this.getUsed(periodKey),
            limit: GLOBAL_DAILY_OPERATION_LIMIT,
            unit: "operations",
            period: "daily",
            resetsAt: nextResetAt(timestampMs),
          },
        ],
      }
      return Response.json(usage)
    }
    return new Response("Not found", { status: 404 })
  }
}

const getUsageLimiterStub = (
  env: OfficialExtractorBindings
): DurableObjectStub => {
  const namespace = env.OFFICIAL_EXTRACTOR_USAGE_LIMITER
  if (!namespace) {
    throw new Error("Usage limiter binding is unavailable.")
  }
  const id = namespace.idFromName(USAGE_LIMITER_NAME)
  return namespace.get(id)
}

export const reserveUsage = async (
  env: OfficialExtractorBindings
): Promise<boolean> => {
  const response = await getUsageLimiterStub(env).fetch(
    "https://usage.internal/reserve",
    { method: "POST" }
  )
  const result: UsageReservationResult = await response.json()
  return result.reserved
}

export const settleUsage = async (
  env: OfficialExtractorBindings,
  succeeded: boolean
): Promise<void> => {
  await getUsageLimiterStub(env).fetch("https://usage.internal/settle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ succeeded }),
  })
}

export const readUsage = async (
  env: OfficialExtractorBindings
): Promise<UsageResponse> => {
  const response = await getUsageLimiterStub(env).fetch(
    "https://usage.internal/usage"
  )
  return response.json()
}

export const usagePeriodForTesting = {
  currentPeriodKey,
  nextResetAt,
  millisecondsPerDay: MILLISECONDS_PER_DAY,
}
