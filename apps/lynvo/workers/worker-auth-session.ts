interface SessionPayload {
  readonly convexSessionId: string
  readonly accessToken: string
  readonly refreshToken: string
  readonly createdAt: number
  readonly expiresAt: number
  readonly idleTimeoutMs?: number
}

interface StoredSession extends SealedRecord {
  readonly createdAt: number
  readonly expiresAt: number
  readonly idleTimeoutMs: number
  readonly idleExpiresAt: number
}

type SessionEnvironment = Partial<Pick<Env, "AUTH_SESSION_ENCRYPTION_KEY">>

const SESSION_STORAGE_KEY = "session"
const UNAVAILABLE_RESPONSE = { error: "Session service is unavailable." }

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

export class WorkerAuthSession implements DurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly environment: SessionEnvironment
  ) {}

  private additionalData = (): Uint8Array<ArrayBuffer> =>
    new TextEncoder().encode(
      `worker-auth-session\u0000${this.state.id.toString()}\u0000${SEALED_RECORD_KEY_VERSION}`
    )

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
      const encodedKey = this.environment.AUTH_SESSION_ENCRYPTION_KEY
      if (!encodedKey) {
        return Response.json(UNAVAILABLE_RESPONSE, { status: 503 })
      }
      let sealedRecord: SealedRecord
      try {
        sealedRecord = await sealRecord({
          encodedKey,
          additionalData: this.additionalData(),
          plaintext: new TextEncoder().encode(
            JSON.stringify({
              convexSessionId: payload.convexSessionId,
              accessToken: payload.accessToken,
              refreshToken: payload.refreshToken,
            })
          ),
        })
      } catch {
        return Response.json(UNAVAILABLE_RESPONSE, { status: 503 })
      }
      const storedSession: StoredSession = {
        ...sealedRecord,
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
      const encodedKey = this.environment.AUTH_SESSION_ENCRYPTION_KEY
      if (!encodedKey) {
        return Response.json(UNAVAILABLE_RESPONSE, { status: 503 })
      }
      try {
        const plaintext = await unsealRecord({
          encodedKey,
          additionalData: this.additionalData(),
          record: storedSession,
        })
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
import type { SealedRecord } from "../app/lib/security/sealed-record"
import { sealRecord, unsealRecord } from "../app/lib/security/sealed-record"
import { SEALED_RECORD_KEY_VERSION } from "../app/lib/security/constants"
