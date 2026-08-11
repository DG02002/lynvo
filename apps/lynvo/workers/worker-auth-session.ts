interface SessionPayload {
  readonly convexSessionId: string
  readonly accessToken: string
  readonly refreshToken: string
  readonly createdAt: number
  readonly expiresAt: number
  readonly idleTimeoutMs?: number
  readonly issuanceGenerationId?: string
}

interface SessionIssuancePayload {
  readonly generationId: string
  readonly nowMs: number
  readonly expiresAt: number
}

interface StoredSessionIssuance {
  readonly generationId: string
  readonly expiresAt: number
}

interface SessionTokenUpdatePayload {
  readonly convexSessionId: string
  readonly accessToken: string
  readonly refreshToken: string
}

interface StoredSession extends SealedRecord {
  readonly createdAt: number
  readonly expiresAt: number
  readonly idleTimeoutMs: number
  readonly idleExpiresAt: number
  readonly lastActivityTouchAt?: number
}

type SessionEnvironment = Partial<Pick<Env, "AUTH_SESSION_ENCRYPTION_KEY">>

const SESSION_STORAGE_KEY = "session"
const SESSION_ISSUANCE_STORAGE_KEY = "session-issuance"
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
  (!("issuanceGenerationId" in payload) ||
    typeof payload.issuanceGenerationId === "string") &&
  (!("idleTimeoutMs" in payload) ||
    (typeof payload.idleTimeoutMs === "number" && payload.idleTimeoutMs > 0))

const isSessionTokenUpdatePayload = (
  payload: unknown
): payload is SessionTokenUpdatePayload =>
  typeof payload === "object" &&
  payload !== null &&
  "accessToken" in payload &&
  "convexSessionId" in payload &&
  "refreshToken" in payload &&
  typeof payload.accessToken === "string" &&
  typeof payload.convexSessionId === "string" &&
  typeof payload.refreshToken === "string" &&
  payload.accessToken.length > 0 &&
  payload.convexSessionId.length > 0 &&
  payload.refreshToken.length > 0

const isSessionIssuancePayload = (
  payload: unknown
): payload is SessionIssuancePayload =>
  typeof payload === "object" &&
  payload !== null &&
  "generationId" in payload &&
  "nowMs" in payload &&
  "expiresAt" in payload &&
  typeof payload.generationId === "string" &&
  typeof payload.nowMs === "number" &&
  typeof payload.expiresAt === "number" &&
  payload.generationId.length > 0 &&
  payload.expiresAt > payload.nowMs

export class WorkerAuthSession implements DurableObject {
  constructor(
    private readonly state: DurableObjectState,
    private readonly environment: SessionEnvironment
  ) {}

  private additionalData = (): Uint8Array<ArrayBuffer> =>
    new TextEncoder().encode(
      `worker-auth-session\u0000${this.state.id.toString()}\u0000${SEALED_RECORD_KEY_VERSION}`
    )

  private sealTokens = async (
    payload: SessionTokenUpdatePayload
  ): Promise<SealedRecord | undefined> => {
    const encodedKey = this.environment.AUTH_SESSION_ENCRYPTION_KEY
    if (!encodedKey) {
      return undefined
    }
    try {
      return await sealRecord({
        encodedKey,
        additionalData: this.additionalData(),
        plaintext: new TextEncoder().encode(JSON.stringify(payload)),
      })
    } catch {
      return undefined
    }
  }

  private readTokens = async (
    storedSession: StoredSession
  ): Promise<SessionTokenUpdatePayload | undefined> => {
    const encodedKey = this.environment.AUTH_SESSION_ENCRYPTION_KEY
    if (!encodedKey) {
      return undefined
    }
    try {
      const plaintext = await unsealRecord({
        encodedKey,
        additionalData: this.additionalData(),
        record: storedSession,
      })
      const tokens: unknown = JSON.parse(new TextDecoder().decode(plaintext))
      return isSessionTokenUpdatePayload(tokens) ? tokens : undefined
    } catch {
      return undefined
    }
  }

  fetch = async (request: Request): Promise<Response> => {
    const url = new URL(request.url)
    if (url.pathname === "/session/issuance") {
      if (request.method !== "POST") {
        return new Response(null, { status: 405 })
      }
      if (await this.state.storage.get(SESSION_STORAGE_KEY)) {
        return new Response(null, { status: 200 })
      }
      const payload: unknown = await request.json()
      if (!isSessionIssuancePayload(payload)) {
        return new Response(null, { status: 400 })
      }
      const issuance = await this.state.storage.get<StoredSessionIssuance>(
        SESSION_ISSUANCE_STORAGE_KEY
      )
      if (issuance && issuance.expiresAt > payload.nowMs) {
        return new Response(null, { status: 409 })
      }
      await this.state.storage.put(SESSION_ISSUANCE_STORAGE_KEY, {
        generationId: payload.generationId,
        expiresAt: payload.expiresAt,
      } satisfies StoredSessionIssuance)
      return new Response(null, { status: 201 })
    }
    if (url.pathname === "/session/tokens") {
      if (request.method !== "PUT") {
        return new Response(null, { status: 405 })
      }
      const storedSession =
        await this.state.storage.get<StoredSession>(SESSION_STORAGE_KEY)
      if (!storedSession) {
        return new Response(null, { status: 404 })
      }
      const payload: unknown = await request.json()
      if (!isSessionTokenUpdatePayload(payload)) {
        return new Response(null, { status: 400 })
      }
      const currentTokens = await this.readTokens(storedSession)
      if (!currentTokens) {
        return Response.json(UNAVAILABLE_RESPONSE, { status: 503 })
      }
      if (currentTokens.convexSessionId !== payload.convexSessionId) {
        return new Response(null, { status: 409 })
      }
      const sealedRecord = await this.sealTokens(payload)
      if (!sealedRecord) {
        return Response.json(UNAVAILABLE_RESPONSE, { status: 503 })
      }
      await this.state.storage.put(SESSION_STORAGE_KEY, {
        ...storedSession,
        ...sealedRecord,
      } satisfies StoredSession)
      return new Response(null, { status: 204 })
    }
    if (url.pathname === "/activity-touch") {
      const storedSession =
        await this.state.storage.get<StoredSession>(SESSION_STORAGE_KEY)
      if (!storedSession) {
        return new Response(null, { status: 404 })
      }
      if (request.method === "GET") {
        return Response.json({
          lastActivityTouchAt:
            storedSession.lastActivityTouchAt ?? storedSession.createdAt,
        })
      }
      if (request.method === "PUT") {
        const payload: unknown = await request.json()
        if (
          typeof payload !== "object" ||
          payload === null ||
          !("touchedAt" in payload) ||
          typeof payload.touchedAt !== "number"
        ) {
          return new Response(null, { status: 400 })
        }
        await this.state.storage.put(SESSION_STORAGE_KEY, {
          ...storedSession,
          lastActivityTouchAt: payload.touchedAt,
        } satisfies StoredSession)
        return new Response(null, { status: 204 })
      }
      return new Response(null, { status: 405 })
    }
    if (url.pathname !== "/session") {
      return new Response(null, { status: 404 })
    }
    if (request.method === "POST") {
      const existingSession =
        await this.state.storage.get<StoredSession>(SESSION_STORAGE_KEY)
      if (existingSession) {
        return new Response(null, { status: 409 })
      }
      const payload: unknown = await request.json()
      if (!isSessionPayload(payload)) {
        return new Response(null, { status: 400 })
      }
      const sealedRecord = await this.sealTokens(payload)
      if (!sealedRecord) {
        return Response.json(UNAVAILABLE_RESPONSE, { status: 503 })
      }
      const issuance = await this.state.storage.get<StoredSessionIssuance>(
        SESSION_ISSUANCE_STORAGE_KEY
      )
      if (issuance && issuance.generationId !== payload.issuanceGenerationId) {
        return new Response(null, { status: 409 })
      }
      if (payload.issuanceGenerationId && !issuance) {
        return new Response(null, { status: 409 })
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
        lastActivityTouchAt: payload.createdAt,
      }
      await this.state.storage.put(SESSION_STORAGE_KEY, storedSession)
      if (issuance) {
        await this.state.storage.delete(SESSION_ISSUANCE_STORAGE_KEY)
      }
      return new Response(null, { status: 204 })
    }
    if (request.method === "DELETE") {
      await this.state.storage.delete(SESSION_STORAGE_KEY)
      await this.state.storage.delete(SESSION_ISSUANCE_STORAGE_KEY)
      return new Response(null, { status: 204 })
    }
    if (request.method === "GET" || request.method === "HEAD") {
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
      if (request.method === "HEAD") {
        return new Response(null, { status: 204 })
      }
      const tokens = await this.readTokens(storedSession)
      if (tokens) {
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
      }
      return this.environment.AUTH_SESSION_ENCRYPTION_KEY
        ? new Response(null, { status: 422 })
        : Response.json(UNAVAILABLE_RESPONSE, { status: 503 })
    }
    return new Response(null, { status: 405 })
  }
}
import type { SealedRecord } from "../app/lib/security/sealed-record"
import { sealRecord, unsealRecord } from "../app/lib/security/sealed-record"
import { SEALED_RECORD_KEY_VERSION } from "../app/lib/security/constants"
