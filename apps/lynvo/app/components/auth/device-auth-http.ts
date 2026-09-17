import { Result, Schema } from "effect"

import { requestSameOrigin } from "~/lib/api/client"

const authorizeErrorResponseSchema = Schema.Struct({ error: Schema.String })
const DEVICE_JSON_HEADERS = { "Content-Type": "application/json" }

export interface DeviceCodeApproval {
  code: string
  status: "pending" | "authorized" | "consumed"
  deviceName: string
  expiresAt: number
}

export const readDeviceCodeApproval = async (
  code: string
): Promise<DeviceCodeApproval | null> => {
  const response = await requestSameOrigin(
    `/api/auth/device/approval?code=${encodeURIComponent(code)}`,
    { headers: DEVICE_JSON_HEADERS }
  )
  if (!response.ok) {
    throw new Error("The login code couldn’t be checked. Try again.")
  }
  return await response.json()
}

export const authorizeDeviceCode = async (code: string): Promise<void> => {
  const response = await requestSameOrigin("/api/auth/device/authorize", {
    method: "POST",
    headers: DEVICE_JSON_HEADERS,
    payload: { code },
  })
  if (!response.ok) {
    const payload = Schema.decodeUnknownResult(authorizeErrorResponseSchema)(
      await response.json().catch(() => null)
    )
    throw new Error(
      Result.isSuccess(payload)
        ? payload.success.error
        : "The login couldn’t be approved. Check the code, then try again."
    )
  }
}

export interface DeviceCodeStatus {
  status:
    | "pending"
    | "authorized"
    | "consumed"
    | "invalid"
    | "rate_limited"
    | "unavailable"
  deviceName?: string
  expiresAt?: number
}

export const readDeviceCodeStatus = async (input: {
  code: string
  pollSecret: string
}): Promise<DeviceCodeStatus> => {
  const response = await requestSameOrigin(
    `/api/auth/device/status?code=${encodeURIComponent(input.code)}&pollSecret=${encodeURIComponent(input.pollSecret)}`,
    { headers: DEVICE_JSON_HEADERS }
  )
  return await response.json()
}

export interface DeviceExchangeClaim {
  userId: string
  deviceName: string
  sessionId: string
}

export const claimDeviceExchange = async (input: {
  code: string
  pollSecret: string
  attemptId: string
  generation: number
}): Promise<DeviceExchangeClaim> => {
  const query = new URLSearchParams({
    code: input.code,
    pollSecret: input.pollSecret,
    attemptId: input.attemptId,
    generation: String(input.generation),
  })
  const response = await requestSameOrigin(
    `/api/auth/device/exchange?${query.toString()}`,
    { headers: DEVICE_JSON_HEADERS }
  )
  if (!response.ok) {
    throw new Error("Approve this code on the signed-in device")
  }
  return await response.json()
}

export const finalizeDeviceExchangeOverHttp = async (input: {
  code: string
  pollSecret: string
  attemptId: string
  generation: number
  sessionId: string
}): Promise<void> => {
  const response = await requestSameOrigin(
    "/api/auth/device/exchange/finalize",
    {
      method: "POST",
      headers: DEVICE_JSON_HEADERS,
      payload: input,
    }
  )
  if (!response.ok) {
    throw new Error(
      "This device couldn’t log in. Generate a new code, then try again."
    )
  }
}
