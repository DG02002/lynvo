interface SessionPayload {
  readonly convexSessionId: string
  readonly accessToken: string
  readonly refreshToken: string
  readonly createdAt: number
  readonly expiresAt: number
  readonly idleTimeoutMs?: number
}

interface StoredSession {
  readonly ciphertext: string
  readonly nonce: string
  readonly algorithm: "AES-256-GCM"
  readonly keyVersion: number
  readonly createdAt: number
  readonly expiresAt: number
  readonly idleTimeoutMs: number
  readonly idleExpiresAt: number
}

type SessionEnvironment = Partial<Pick<Env, "AUTH_SESSION_MASTER_KEY">>

const SESSION_STORAGE_KEY = "session"
const ALGORITHM = "AES-256-GCM"
const WEB_CRYPTO_ALGORITHM = "AES-GCM"
const KEY_VERSION = 1
const KEY_LENGTH_BYTES = 32
const NONCE_LENGTH_BYTES = 12
const UNAVAILABLE_RESPONSE = { error: "Session service is unavailable." }

const decodeBase64 = (value: string): Uint8Array<ArrayBuffer> => {
  const decoded = atob(value)
  const bytes = new Uint8Array(decoded.length)
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index)
  }
  return bytes
}

const encodeBase64 = (value: ArrayBuffer): string => {
  let encoded = ""
  for (const byte of new Uint8Array(value)) {
    encoded += String.fromCharCode(byte)
  }
  return btoa(encoded)
}

const isSessionPayload = (payload: unknown): payload is SessionPayload =>
  typeof payload === "object" &&
  payload !== null &&
  "accessToken" in payload &&
  "convexSessionId" in payload &&
  "refreshToken" in payload &&
  "createdAt" in payload &&
  "expiresAt" in payload &&
  typeof payload.accessToken === "string" &&
  typeof payload.convexSessionId === "string" &&
  typeof payload.refreshToken === "string" &&
  typeof payload.createdAt === "number" &&
  typeof payload.expiresAt === "number" &&
  payload.accessToken.length > 0 &&
  payload.convexSessionId.length > 0 &&
  payload.refreshToken.length > 0 &&
  payload.expiresAt > payload.createdAt &&
  (!("idleTimeoutMs" in payload) ||
    (typeof payload.idleTimeoutMs === "number" && payload.idleTimeoutMs > 0))

const importMasterKey = async (encodedKey: string): Promise<CryptoKey> => {
  const bytes = decodeBase64(encodedKey)
  if (bytes.byteLength !== KEY_LENGTH_BYTES) {
    throw new Error("Invalid session master key")
  }
  return await crypto.subtle.importKey(
    "raw",
    bytes,
    { name: WEB_CRYPTO_ALGORITHM },
    false,
    ["encrypt", "decrypt"]
  )
}

export class WorkerAuthSession implements DurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly environment: SessionEnvironment
  ) {}

  private additionalData = (): Uint8Array<ArrayBuffer> =>
    new TextEncoder().encode(
      `worker-auth-session\u0000${this.state.id.toString()}\u0000${KEY_VERSION}`
    )

  private getMasterKey = async (): Promise<CryptoKey | undefined> => {
    const encodedKey = this.environment.AUTH_SESSION_MASTER_KEY
    if (!encodedKey) {
      return undefined
    }
    try {
      return await importMasterKey(encodedKey)
    } catch {
      return undefined
    }
  }

  fetch = async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    if (url.pathname !== "/session") {
      return new Response(null, { status: 404 })
    }
    if (request.method === "POST") {
      const payload: unknown = await request.json()
      if (!isSessionPayload(payload)) {
        return new Response(null, { status: 400 })
      }
      const masterKey = await this.getMasterKey()
      if (!masterKey) {
        return Response.json(UNAVAILABLE_RESPONSE, { status: 503 })
      }
      const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH_BYTES))
      const ciphertext = await crypto.subtle.encrypt(
        {
          name: WEB_CRYPTO_ALGORITHM,
          iv: nonce,
          additionalData: this.additionalData(),
        },
        masterKey,
        new TextEncoder().encode(
          JSON.stringify({
            convexSessionId: payload.convexSessionId,
            accessToken: payload.accessToken,
            refreshToken: payload.refreshToken,
          })
        )
      )
      const storedSession: StoredSession = {
        ciphertext: encodeBase64(ciphertext),
        nonce: encodeBase64(nonce.buffer),
        algorithm: ALGORITHM,
        keyVersion: KEY_VERSION,
        createdAt: payload.createdAt,
        expiresAt: payload.expiresAt,
        idleTimeoutMs:
          payload.idleTimeoutMs ?? payload.expiresAt - payload.createdAt,
        idleExpiresAt: Math.min(
          payload.createdAt +
            (payload.idleTimeoutMs ?? payload.expiresAt - payload.createdAt),
          payload.expiresAt
        ),
      }
      await this.state.storage.put(SESSION_STORAGE_KEY, storedSession)
      return new Response(null, { status: 204 })
    }
    if (request.method === "DELETE") {
      await this.state.storage.delete(SESSION_STORAGE_KEY)
      return new Response(null, { status: 204 })
    }
    if (request.method === "GET") {
      const storedSession =
        await this.state.storage.get<StoredSession>(SESSION_STORAGE_KEY)
      const nowParameter = url.searchParams.get("nowMs")
      const nowMs = nowParameter ? Number(nowParameter) : Date.now()
      if (!storedSession) {
        return new Response(null, { status: 404 })
      }
      if (
        !Number.isFinite(nowMs) ||
        nowMs >= storedSession.expiresAt ||
        nowMs >= storedSession.idleExpiresAt
      ) {
        await this.state.storage.delete(SESSION_STORAGE_KEY)
        return new Response(null, { status: 401 })
      }
      const masterKey = await this.getMasterKey()
      if (!masterKey) {
        return Response.json(UNAVAILABLE_RESPONSE, { status: 503 })
      }
      try {
        const plaintext = await crypto.subtle.decrypt(
          {
            name: WEB_CRYPTO_ALGORITHM,
            iv: decodeBase64(storedSession.nonce),
            additionalData: this.additionalData(),
          },
          masterKey,
          decodeBase64(storedSession.ciphertext)
        )
        const tokens: unknown = JSON.parse(new TextDecoder().decode(plaintext))
        if (
          typeof tokens !== "object" ||
          tokens === null ||
          !("accessToken" in tokens) ||
          !("convexSessionId" in tokens) ||
          !("refreshToken" in tokens) ||
          typeof tokens.accessToken !== "string" ||
          typeof tokens.convexSessionId !== "string" ||
          typeof tokens.refreshToken !== "string"
        ) {
          return new Response(null, { status: 422 })
        }
        await this.state.storage.put(SESSION_STORAGE_KEY, {
          ...storedSession,
          idleExpiresAt: Math.min(
            nowMs + storedSession.idleTimeoutMs,
            storedSession.expiresAt
          ),
        } satisfies StoredSession)
        return Response.json({
          convexSessionId: tokens.convexSessionId,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          createdAt: storedSession.createdAt,
          expiresAt: storedSession.expiresAt,
        } satisfies SessionPayload)
      } catch {
        return new Response(null, { status: 422 })
      }
    }
    return new Response(null, { status: 405 })
  }
}
