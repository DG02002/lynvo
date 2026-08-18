import { z } from "zod"

export type AuthPreflightFlow = "signUp" | "signIn"

export interface AuthPreflightPayload {
  readonly flow: AuthPreflightFlow
  readonly normalizedUsername: string
  readonly exp: number
}

export interface DeviceCodePreflightPayload {
  readonly purpose: "deviceCode"
  readonly exp: number
}

export interface CredentialReadPayload {
  readonly purpose: "credentialRead"
  readonly exp: number
}

export interface SessionCleanupPayload {
  readonly purpose: "sessionCleanup"
  readonly exp: number
}

export interface RemoteCommandNotificationPayload {
  readonly purpose: "remoteCommandNotification"
  readonly exp: number
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const unexpiredPayloadSchema = z
  .object({ exp: z.number() })
  .refine((payload) => payload.exp >= Date.now())
const authPreflightPayloadSchema = unexpiredPayloadSchema.extend({
  flow: z.enum(["signUp", "signIn"]),
  normalizedUsername: z.string(),
})
const deviceCodePreflightPayloadSchema = unexpiredPayloadSchema.extend({
  purpose: z.literal("deviceCode"),
})
const credentialReadPayloadSchema = unexpiredPayloadSchema.extend({
  purpose: z.literal("credentialRead"),
})
const sessionCleanupPayloadSchema = unexpiredPayloadSchema.extend({
  purpose: z.literal("sessionCleanup"),
})
const remoteCommandNotificationPayloadSchema = unexpiredPayloadSchema.extend({
  purpose: z.literal("remoteCommandNotification"),
})

const encodeText = (value: string): Uint8Array<ArrayBuffer> => {
  const bytes: Uint8Array<ArrayBuffer> = new Uint8Array(
    new ArrayBuffer(value.length * 3)
  )
  const result = encoder.encodeInto(value, bytes)
  return bytes.slice(0, result.written)
}

const base64UrlToBytes = (value: string): Uint8Array<ArrayBuffer> => {
  const padded = value.padEnd(
    value.length + ((4 - (value.length % 4)) % 4),
    "="
  )
  const binary = atob(padded.replaceAll("-", "+").replaceAll("_", "/"))
  const bytes: Uint8Array<ArrayBuffer> = new Uint8Array(
    new ArrayBuffer(binary.length)
  )
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

const hmacKey = (secret: string) =>
  crypto.subtle.importKey(
    "raw",
    encodeText(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  )

const verifyGatewayToken = async (token: string, secret: string) => {
  const [encodedPayload, encodedSignature] = token.split(".")
  if (!encodedPayload || !encodedSignature) {
    throw new Error("Invalid auth preflight token")
  }
  const isValidSignature = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret),
    base64UrlToBytes(encodedSignature),
    encodeText(encodedPayload)
  )
  if (!isValidSignature) {
    throw new Error("Invalid auth preflight token")
  }

  return z
    .json()
    .parse(JSON.parse(decoder.decode(base64UrlToBytes(encodedPayload))))
}

export const verifyAuthPreflightToken = async (
  token: string,
  secret: string
): Promise<AuthPreflightPayload> => {
  const payload = authPreflightPayloadSchema.safeParse(
    await verifyGatewayToken(token, secret)
  )
  if (!payload.success) {
    throw new Error("Expired auth preflight token")
  }
  return payload.data
}

export const verifyDeviceCodePreflightToken = async (
  token: string,
  secret: string
): Promise<DeviceCodePreflightPayload> => {
  const payload = deviceCodePreflightPayloadSchema.safeParse(
    await verifyGatewayToken(token, secret)
  )
  if (!payload.success) {
    throw new Error("Expired device code preflight token")
  }
  return payload.data
}

export const verifyCredentialReadToken = async (
  token: string,
  secret: string
): Promise<CredentialReadPayload> => {
  const payload = credentialReadPayloadSchema.safeParse(
    await verifyGatewayToken(token, secret)
  )
  if (!payload.success) {
    throw new Error("Expired credential read token")
  }
  return payload.data
}

export const verifySessionCleanupToken = async (
  token: string,
  secret: string
): Promise<SessionCleanupPayload> => {
  const payload = sessionCleanupPayloadSchema.safeParse(
    await verifyGatewayToken(token, secret)
  )
  if (!payload.success) {
    throw new Error("Expired session cleanup token")
  }
  return payload.data
}

export const verifyRemoteCommandNotificationToken = async (
  token: string,
  secret: string
): Promise<RemoteCommandNotificationPayload> => {
  const payload = remoteCommandNotificationPayloadSchema.safeParse(
    await verifyGatewayToken(token, secret)
  )
  if (!payload.success) {
    throw new Error("Expired remote command notification token")
  }
  return payload.data
}
