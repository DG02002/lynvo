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

export interface SavedLinkRealtimePayload {
  readonly purpose: "savedLinkRealtime"
  readonly exp: number
}

export interface AccountSettingsRealtimePayload {
  readonly purpose: "accountSettingsRealtime"
  readonly exp: number
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

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

  return JSON.parse(decoder.decode(base64UrlToBytes(encodedPayload))) as unknown
}

export const verifyAuthPreflightToken = async (
  token: string,
  secret: string
): Promise<AuthPreflightPayload> => {
  const payload = await verifyGatewayToken(token, secret)
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("flow" in payload) ||
    !("normalizedUsername" in payload) ||
    !("exp" in payload) ||
    (payload.flow !== "signUp" && payload.flow !== "signIn") ||
    typeof payload.normalizedUsername !== "string" ||
    typeof payload.exp !== "number" ||
    payload.exp < Date.now()
  ) {
    throw new Error("Expired auth preflight token")
  }
  return {
    flow: payload.flow,
    normalizedUsername: payload.normalizedUsername,
    exp: payload.exp,
  }
}

export const verifyDeviceCodePreflightToken = async (
  token: string,
  secret: string
): Promise<DeviceCodePreflightPayload> => {
  const payload = await verifyGatewayToken(token, secret)
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("purpose" in payload) ||
    !("exp" in payload) ||
    payload.purpose !== "deviceCode" ||
    typeof payload.exp !== "number" ||
    payload.exp < Date.now()
  ) {
    throw new Error("Expired device code preflight token")
  }
  return { purpose: payload.purpose, exp: payload.exp }
}

export const verifyCredentialReadToken = async (
  token: string,
  secret: string
): Promise<CredentialReadPayload> => {
  const payload = await verifyGatewayToken(token, secret)
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("purpose" in payload) ||
    !("exp" in payload) ||
    payload.purpose !== "credentialRead" ||
    typeof payload.exp !== "number" ||
    payload.exp < Date.now()
  ) {
    throw new Error("Expired credential read token")
  }
  return { purpose: payload.purpose, exp: payload.exp }
}

export const verifySessionCleanupToken = async (
  token: string,
  secret: string
): Promise<SessionCleanupPayload> => {
  const payload = await verifyGatewayToken(token, secret)
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("purpose" in payload) ||
    !("exp" in payload) ||
    payload.purpose !== "sessionCleanup" ||
    typeof payload.exp !== "number" ||
    payload.exp < Date.now()
  ) {
    throw new Error("Expired session cleanup token")
  }
  return { purpose: payload.purpose, exp: payload.exp }
}

export const verifySavedLinkRealtimeToken = async (
  token: string,
  secret: string
): Promise<SavedLinkRealtimePayload> => {
  const payload = await verifyGatewayToken(token, secret)
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("purpose" in payload) ||
    !("exp" in payload) ||
    payload.purpose !== "savedLinkRealtime" ||
    typeof payload.exp !== "number" ||
    payload.exp < Date.now()
  ) {
    throw new Error("Expired Saved link realtime token")
  }
  return { purpose: payload.purpose, exp: payload.exp }
}

export const verifyAccountSettingsRealtimeToken = async (
  token: string,
  secret: string
): Promise<AccountSettingsRealtimePayload> => {
  const payload = await verifyGatewayToken(token, secret)
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("purpose" in payload) ||
    !("exp" in payload) ||
    payload.purpose !== "accountSettingsRealtime" ||
    typeof payload.exp !== "number" ||
    payload.exp < Date.now()
  ) {
    throw new Error("Expired account settings realtime token")
  }
  return { purpose: payload.purpose, exp: payload.exp }
}
