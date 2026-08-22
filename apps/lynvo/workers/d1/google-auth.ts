import { z } from "zod"
import { getCookieValue } from "../../app/lib/auth-cookie"
import {
  GOOGLE_OAUTH_AUTH_ENDPOINT,
  GOOGLE_OAUTH_CODE_VERIFIER_BYTES,
  GOOGLE_OAUTH_ISSUERS,
  GOOGLE_OAUTH_SCOPE,
  GOOGLE_OAUTH_STATE_BYTES,
  GOOGLE_OAUTH_STATE_COOKIE_NAME,
  GOOGLE_OAUTH_STATE_TTL_MS,
  GOOGLE_OAUTH_TOKEN_ENDPOINT,
  GOOGLE_OAUTH_TOKEN_TIMEOUT_MS,
} from "../constants"

export interface GoogleOAuthCredentials {
  readonly clientId: string
  readonly clientSecret: string
}

export interface GoogleProfile {
  readonly subject: string
  readonly email: string
  readonly displayName: string | null
  readonly avatarUrl: string | null
}

interface StatePayload {
  state: string
  codeVerifier: string
  returnTo: string
  expiresAt: number
}

const statePayloadSchema = z.object({
  state: z.string().min(1),
  codeVerifier: z.string().min(1),
  returnTo: z.string(),
  expiresAt: z.number(),
})

const tokenResponseSchema = z.object({
  id_token: z.string().min(1),
})

const idTokenPayloadSchema = z.object({
  iss: z.string(),
  aud: z.string(),
  exp: z.number(),
  sub: z.string().min(1),
  email: z.string().min(1),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
  picture: z.string().optional(),
})

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = ""
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "")
}

const fromBase64Url = (value: string): Uint8Array => {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/")
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")
  const binary = atob(padded)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

const randomBase64Url = (byteCount: number): string =>
  toBase64Url(crypto.getRandomValues(new Uint8Array(byteCount)))

const deriveStateKey = async (clientSecret: string): Promise<CryptoKey> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(clientSecret)
  )
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ])
}

export const encryptStatePayload = async (
  payload: StatePayload,
  clientSecret: string
): Promise<string> => {
  const initializationVector = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveStateKey(clientSecret)
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: initializationVector },
      key,
      new TextEncoder().encode(JSON.stringify(payload))
    )
  )
  const value = new Uint8Array(initializationVector.length + ciphertext.length)
  value.set(initializationVector)
  value.set(ciphertext, initializationVector.length)
  return toBase64Url(value)
}

export const decryptStatePayload = async (
  value: string,
  clientSecret: string
): Promise<StatePayload | null> => {
  try {
    const encrypted = fromBase64Url(value)
    const key = await deriveStateKey(clientSecret)
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: encrypted.slice(0, 12) },
      key,
      encrypted.slice(12)
    )
    const parsed = statePayloadSchema.safeParse(
      JSON.parse(new TextDecoder().decode(plaintext))
    )
    return parsed.success ? parsed.data : null
  } catch {
    return null
  }
}

export const normalizeGoogleReturnTo = (value: string | undefined): string =>
  value && value.startsWith("/") && !value.startsWith("//") ? value : "/"

export const createGoogleSignInStart = async (input: {
  readonly credentials: GoogleOAuthCredentials
  readonly origin: string
  readonly returnTo: string
  readonly now: number
}): Promise<{ redirectUrl: string; stateCookie: string }> => {
  const state = randomBase64Url(GOOGLE_OAUTH_STATE_BYTES)
  const codeVerifier = randomBase64Url(GOOGLE_OAUTH_CODE_VERIFIER_BYTES)
  const redirectUri = `${input.origin}/api/auth/callback/google`
  const stateCookieValue = await encryptStatePayload(
    {
      state,
      codeVerifier,
      returnTo: input.returnTo,
      expiresAt: input.now + GOOGLE_OAUTH_STATE_TTL_MS,
    },
    input.credentials.clientSecret
  )
  const challengeDigest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(codeVerifier)
  )
  const url = new URL(GOOGLE_OAUTH_AUTH_ENDPOINT)
  url.searchParams.set("client_id", input.credentials.clientId)
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("scope", GOOGLE_OAUTH_SCOPE)
  url.searchParams.set("state", state)
  url.searchParams.set(
    "code_challenge",
    toBase64Url(new Uint8Array(challengeDigest))
  )
  url.searchParams.set("code_challenge_method", "S256")
  const stateCookie = [
    `${GOOGLE_OAUTH_STATE_COOKIE_NAME}=${encodeURIComponent(stateCookieValue)}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
    `Path=/`,
    `Max-Age=${Math.floor(GOOGLE_OAUTH_STATE_TTL_MS / 1000)}`,
  ].join("; ")
  return { redirectUrl: url.toString(), stateCookie }
}

export const exchangeGoogleAuthorizationCode = async (input: {
  readonly credentials: GoogleOAuthCredentials
  readonly redirectUri: string
  readonly code: string
  readonly codeVerifier: string
}): Promise<string | null> => {
  const form = new FormData()
  form.set("client_id", input.credentials.clientId)
  form.set("client_secret", input.credentials.clientSecret)
  form.set("code", input.code)
  form.set("code_verifier", input.codeVerifier)
  form.set("grant_type", "authorization_code")
  form.set("redirect_uri", input.redirectUri)
  let response
  try {
    response = await fetch(GOOGLE_OAUTH_TOKEN_ENDPOINT, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(GOOGLE_OAUTH_TOKEN_TIMEOUT_MS),
    })
  } catch {
    return null
  }
  if (!response.ok) {
    return null
  }
  const parsed = tokenResponseSchema.safeParse(await response.json())
  return parsed.success ? parsed.data.id_token : null
}

export const parseVerifiedGoogleProfile = (
  idToken: string,
  credentials: GoogleOAuthCredentials,
  now: number
): GoogleProfile | null => {
  const payloadPart = idToken.split(".")[1]
  if (!payloadPart) {
    return null
  }
  try {
    const parsed = idTokenPayloadSchema.safeParse(
      JSON.parse(new TextDecoder().decode(fromBase64Url(payloadPart)))
    )
    if (!parsed.success) {
      return null
    }
    const claims = parsed.data
    if (!GOOGLE_OAUTH_ISSUERS.includes(claims.iss)) {
      return null
    }
    if (claims.aud !== credentials.clientId || claims.exp * 1000 <= now) {
      return null
    }
    if (claims.email_verified !== true) {
      return null
    }
    return {
      subject: claims.sub,
      email: claims.email,
      displayName: claims.name ?? null,
      avatarUrl: claims.picture ?? null,
    }
  } catch {
    return null
  }
}

export interface GoogleCallbackRequest {
  code: string | null
  state: string | null
  error: string | null
}

export const readGoogleCallbackRequest = (
  request: Request
): GoogleCallbackRequest => {
  const url = new URL(request.url)
  return {
    code: url.searchParams.get("code"),
    state: url.searchParams.get("state"),
    error: url.searchParams.get("error"),
  }
}

export const readGoogleStateCookie = (
  request: Request,
  clientSecret: string
): Promise<StatePayload | null> => {
  const value = getCookieValue(request, GOOGLE_OAUTH_STATE_COOKIE_NAME)
  return value
    ? decryptStatePayload(value, clientSecret)
    : Promise.resolve(null)
}
