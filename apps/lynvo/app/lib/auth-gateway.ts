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

const encoder = new TextEncoder()

const base64UrlEncode = (bytes: Uint8Array): string => {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "")
}

const hmacKey = (secret: string) =>
  crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  )

export const signAuthPreflightToken = async (
  payload: AuthPreflightPayload | DeviceCodePreflightPayload,
  secret: string
): Promise<string> => {
  const encodedPayload = base64UrlEncode(
    encoder.encode(JSON.stringify(payload))
  )
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      await hmacKey(secret),
      encoder.encode(encodedPayload)
    )
  )
  return `${encodedPayload}.${base64UrlEncode(signature)}`
}
