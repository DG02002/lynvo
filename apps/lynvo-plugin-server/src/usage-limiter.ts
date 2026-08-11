import type { UsageResponse } from "@dg02002/lynvo-plugin-server-protocol"
import {
  GLOBAL_DAILY_OPERATION_LIMIT,
  MILLISECONDS_PER_DAY,
  USAGE_RESERVATION_LEASE_MS,
  USAGE_RESERVATION_SETTLEMENT_GRACE_MS,
  USAGE_LIMITER_NAME,
} from "./constants"

export interface UsageCounterRow {
  [column: string]: SqlStorageValue
  used: number
}

export interface UsageReservationResult {
  reserved: boolean
  periodKey: string
  reservationId: string | null
}

export interface UsageReservationRow {
  [column: string]: SqlStorageValue
  reservation_id: string
  period_key: string
  status: string
  expires_at: number
}

export interface UsagePendingCountRow {
  [column: string]: SqlStorageValue
  pending: number
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

export class LynvoPluginServerUsageLimiter {
  private readonly state: DurableObjectState

  constructor(state: DurableObjectState) {
    this.state = state
    this.state.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS usage_counters (period_key TEXT PRIMARY KEY, used INTEGER NOT NULL)"
    )
    this.state.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS usage_reservations (reservation_id TEXT PRIMARY KEY, period_key TEXT NOT NULL, status TEXT NOT NULL, expires_at INTEGER NOT NULL)"
    )
    this.state.storage.sql.exec(
      "CREATE INDEX IF NOT EXISTS usage_reservations_pending_expiry ON usage_reservations(status, expires_at)"
    )
  }

  private getUsed(periodKey: string): number {
    const row = this.state.storage.sql
      .exec<UsageCounterRow>(
        "SELECT used FROM usage_counters WHERE period_key = ?",
        periodKey
      )
      .toArray()[0]
    const pendingRow = this.state.storage.sql
      .exec<UsagePendingCountRow>(
        "SELECT COUNT(*) AS pending FROM usage_reservations WHERE period_key = ? AND status IN ('pending', 'expired')",
        periodKey
      )
      .toArray()[0]
    return (row?.used ?? 0) + (pendingRow?.pending ?? 0)
  }

  private reserve(
    periodKey: string,
    timestampMs: number
  ): UsageReservationResult {
    const used = this.getUsed(periodKey)
    if (used >= GLOBAL_DAILY_OPERATION_LIMIT) {
      return { reserved: false, periodKey, reservationId: null }
    }
    const reservationId = crypto.randomUUID()
    this.state.storage.sql.exec(
      "INSERT INTO usage_reservations (reservation_id, period_key, status, expires_at) VALUES (?, ?, 'pending', ?)",
      reservationId,
      periodKey,
      timestampMs + USAGE_RESERVATION_LEASE_MS
    )
    return { reserved: true, periodKey, reservationId }
  }

  private settle(reservationId: string, succeeded: boolean): void {
    this.state.storage.transactionSync(() => {
      const reservation = this.state.storage.sql
        .exec<UsageReservationRow>(
          "SELECT reservation_id, period_key, status, expires_at FROM usage_reservations WHERE reservation_id = ?",
          reservationId
        )
        .toArray()[0]
      if (
        !reservation ||
        (reservation.status !== "pending" && reservation.status !== "expired")
      ) {
        return
      }
      if (succeeded) {
        this.state.storage.sql.exec(
          "INSERT INTO usage_counters (period_key, used) VALUES (?, 1) ON CONFLICT(period_key) DO UPDATE SET used = used + 1",
          reservation.period_key
        )
      }
      this.state.storage.sql.exec(
        "UPDATE usage_reservations SET status = ? WHERE reservation_id = ? AND status IN ('pending', 'expired')",
        succeeded ? "succeeded" : "failed",
        reservationId
      )
    })
  }

  private scheduleNextAlarm = async (): Promise<void> => {
    const next = this.state.storage.sql
      .exec<UsageReservationRow>(
        "SELECT reservation_id, period_key, status, expires_at FROM usage_reservations WHERE status IN ('pending', 'expired') ORDER BY expires_at ASC LIMIT 1"
      )
      .toArray()[0]
    if (next) {
      const currentAlarm = await this.state.storage.getAlarm()
      if (currentAlarm === null || next.expires_at < currentAlarm) {
        await this.state.storage.setAlarm(next.expires_at)
      }
    }
  }

  async alarm(): Promise<void> {
    this.state.storage.sql.exec(
      "UPDATE usage_reservations SET status = 'expired', expires_at = expires_at + ? WHERE status = 'pending' AND expires_at <= ?",
      USAGE_RESERVATION_SETTLEMENT_GRACE_MS,
      Date.now()
    )
    this.state.storage.sql.exec(
      "DELETE FROM usage_reservations WHERE status = 'expired' AND expires_at <= ?",
      Date.now()
    )
    await this.scheduleNextAlarm()
  }

  async fetch(request: Request): Promise<Response> {
    const nowHeader = request.headers.get("x-lynvo-now-ms")
    const timestampMs = nowHeader ? Number(nowHeader) : Date.now()
    const periodKey = currentPeriodKey(timestampMs)
    const pathname = new URL(request.url).pathname

    if (pathname === "/reserve" && request.method === "POST") {
      const reservation = this.reserve(periodKey, timestampMs)
      if (reservation.reserved) {
        await this.scheduleNextAlarm()
      }
      return Response.json(reservation)
    }
    if (pathname === "/settle" && request.method === "POST") {
      const body: unknown = await request.json()
      if (
        typeof body === "object" &&
        body !== null &&
        "succeeded" in body &&
        "reservationId" in body &&
        typeof body.reservationId === "string" &&
        typeof body.succeeded === "boolean"
      ) {
        this.settle(body.reservationId, body.succeeded)
        await this.scheduleNextAlarm()
      }
      return new Response(null, { status: 204 })
    }
    if (pathname === "/usage" && request.method === "GET") {
      const usage: UsageResponse = {
        metrics: [
          {
            id: "lynvo-plugin-server-operations",
            label: "Lynvo Plugin Server operations",
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
  env: LynvoPluginServerBindings
): DurableObjectStub => {
  const namespace = env.LYNVO_PLUGIN_SERVER_USAGE_LIMITER
  if (!namespace) {
    throw new Error("Usage limiter binding is unavailable.")
  }
  const id = namespace.idFromName(USAGE_LIMITER_NAME)
  return namespace.get(id)
}

export const reserveUsage = async (
  env: LynvoPluginServerBindings
): Promise<UsageReservationResult> => {
  const response = await getUsageLimiterStub(env).fetch(
    "https://usage.internal/reserve",
    { method: "POST" }
  )
  const result: UsageReservationResult = await response.json()
  return result
}

export const settleUsage = async (
  env: LynvoPluginServerBindings,
  succeeded: boolean,
  reservationId: string
): Promise<void> => {
  await getUsageLimiterStub(env).fetch("https://usage.internal/settle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ succeeded, reservationId }),
  })
}

export const readUsage = async (
  env: LynvoPluginServerBindings
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
