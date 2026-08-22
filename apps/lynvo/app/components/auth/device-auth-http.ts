import { sessionIdentityHeaders } from "~/lib/session-identity"
import { z } from "zod"

const authorizeErrorResponseSchema = z.object({ error: z.string() })

const sameOriginJson = async (
  input: string,
  init?: RequestInit
): Promise<Response> =>
  await fetch(input, {
    ...init,
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...sessionIdentityHeaders(),
      ...init?.headers,
    },
  })

export interface DeviceCodeApproval {
  code: string
  status: "pending" | "authorized" | "consumed"
  deviceName: string
  expiresAt: number
}

export const readDeviceCodeApproval = async (
  code: string
): Promise<DeviceCodeApproval | null> => {
  const response = await sameOriginJson(
    `/api/auth/device/approval?code=${encodeURIComponent(code)}`
  )
  if (!response.ok) {
    throw new Error("The login code couldn’t be checked. Try again.")
  }
  return await response.json()
}

export const authorizeDeviceCode = async (code: string): Promise<void> => {
  const response = await sameOriginJson("/api/auth/device/authorize", {
    method: "POST",
    body: JSON.stringify({ code }),
  })
  if (!response.ok) {
    const payload = authorizeErrorResponseSchema.safeParse(
      await response.json().catch(() => null)
    )
    throw new Error(
      payload.success
        ? payload.data.error
        : "The login couldn’t be approved. Check the code, then try again."
    )
  }
}

export interface DeviceCodeStatus {
  status: "pending" | "authorized" | "consumed" | "invalid" | "rate_limited"
  deviceName?: string
  expiresAt?: number
}

export const readDeviceCodeStatus = async (input: {
  code: string
  pollSecret: string
}): Promise<DeviceCodeStatus> => {
  const response = await sameOriginJson(
    `/api/auth/device/status?code=${encodeURIComponent(input.code)}&pollSecret=${encodeURIComponent(input.pollSecret)}`
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
  const response = await sameOriginJson(
    `/api/auth/device/exchange?${query.toString()}`
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
  const response = await sameOriginJson("/api/auth/device/exchange/finalize", {
    method: "POST",
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error(
      "This device couldn’t log in. Generate a new code, then try again."
    )
  }
}
