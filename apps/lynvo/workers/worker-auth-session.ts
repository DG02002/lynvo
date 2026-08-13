import type { SealedRecord } from "../app/lib/security/sealed-record"
import { sealRecord, unsealRecord } from "../app/lib/security/sealed-record"
import { SEALED_RECORD_KEY_VERSION } from "../app/lib/security/constants"
import { AUTH_SESSION_ISSUANCE_GENERATION_RETENTION_MS } from "./constants"
import { z } from "zod"

interface SessionPayload {
  readonly convexSessionId: string
  readonly accessToken: string
  readonly refreshToken: string
  readonly createdAt: number
  readonly expiresAt: number
  readonly idleTimeoutMs?: number
  readonly issuanceGeneration?: number
}

interface SessionIssuancePayload {
  readonly nowMs: number
  readonly expiresAt: number
}

interface StoredSessionIssuance {
  readonly generation: number
  readonly expiresAt: number
}

interface SessionTokenUpdatePayload {
  readonly convexSessionId: string
  readonly accessToken: string
  readonly refreshToken: string
}

interface StoredSession extends SealedRecord {
  readonly instanceId?: string
  readonly createdAt: number
  readonly expiresAt: number
  readonly idleTimeoutMs: number
  readonly idleExpiresAt: number
  readonly lastActivityTouchAt?: number
  readonly revision?: number
  readonly issuanceGeneration?: number
}

type SessionEnvironment = Partial<Pick<Env, "AUTH_SESSION_ENCRYPTION_KEY">>

const SESSION_STORAGE_KEY = "session"
const SESSION_ISSUANCE_STORAGE_KEY = "session-issuance"
const SESSION_ISSUANCE_GENERATION_KEY = "session-issuance-generation"
const SESSION_ISSUANCE_GENERATION_RETENTION_KEY =
  "session-issuance-generation-retention"
const UNAVAILABLE_RESPONSE = { error: "Session service is unavailable." }

const sessionTokenUpdatePayloadSchema = z.object({
  convexSessionId: z.string().min(1),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
})

const sessionPayloadSchema = sessionTokenUpdatePayloadSchema
  .extend({
    createdAt: z.number(),
    expiresAt: z.number(),
    idleTimeoutMs: z.number().positive().optional(),
    issuanceGeneration: z.number().int().positive().optional(),
  })
  .refine((payload) => payload.expiresAt > payload.createdAt)

const sessionIssuancePayloadSchema = z
  .object({ nowMs: z.number(), expiresAt: z.number() })
  .refine((payload) => payload.expiresAt > payload.nowMs)

const activityTouchPayloadSchema = z.object({ touchedAt: z.number() })

const isSessionPayload = <Value>(
  payload: Value
): payload is Value & SessionPayload =>
  sessionPayloadSchema.safeParse(payload).success

const isSessionTokenUpdatePayload = <Value>(
  payload: Value
): payload is Value & SessionTokenUpdatePayload =>
  sessionTokenUpdatePayloadSchema.safeParse(payload).success

const isSessionIssuancePayload = <Value>(
  payload: Value
): payload is Value & SessionIssuancePayload =>
  sessionIssuancePayloadSchema.safeParse(payload).success

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
      const payload: unknown = await request.json()
      if (!isSessionIssuancePayload(payload)) {
        return new Response(null, { status: 400 })
      }
      const result = await this.state.storage.transaction(async (storage) => {
        if (await storage.get(SESSION_STORAGE_KEY)) {
          return { kind: "established" } as const
        }
        const issuance = await storage.get<StoredSessionIssuance>(
          SESSION_ISSUANCE_STORAGE_KEY
        )
        if (issuance && issuance.expiresAt > payload.nowMs) {
          return { kind: "pending" } as const
        }
        const currentGeneration =
          (await storage.get<number>(SESSION_ISSUANCE_GENERATION_KEY)) ?? 0
        const generation = currentGeneration + 1
        const retentionExpiresAt =
          payload.nowMs + AUTH_SESSION_ISSUANCE_GENERATION_RETENTION_MS
        await storage.put(SESSION_ISSUANCE_STORAGE_KEY, {
          generation,
          expiresAt: payload.expiresAt,
        } satisfies StoredSessionIssuance)
        await storage.put(SESSION_ISSUANCE_GENERATION_KEY, generation)
        await storage.put(
          SESSION_ISSUANCE_GENERATION_RETENTION_KEY,
          retentionExpiresAt
        )
        const currentAlarm = await storage.getAlarm()
        if (currentAlarm === null || currentAlarm < retentionExpiresAt) {
          await storage.setAlarm(retentionExpiresAt)
        }
        return { kind: "acquired", generation } as const
      })
      if (result.kind === "established") {
        return new Response(null, { status: 200 })
      }
      if (result.kind === "pending") {
        return new Response(null, { status: 409 })
      }
      return Response.json({ generation: result.generation }, { status: 201 })
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
      const updateResult = await this.state.storage.transaction(
        async (storage) => {
          const currentSession =
            await storage.get<StoredSession>(SESSION_STORAGE_KEY)
          if (!currentSession) {
            return "missing" as const
          }
          if (
            currentSession.instanceId !== storedSession.instanceId ||
            (currentSession.revision ?? 0) !== (storedSession.revision ?? 0)
          ) {
            return "conflict" as const
          }
          await storage.put(SESSION_STORAGE_KEY, {
            ...currentSession,
            ...sealedRecord,
            revision: (currentSession.revision ?? 0) + 1,
          } satisfies StoredSession)
          return "updated" as const
        }
      )
      if (updateResult === "missing") {
        return new Response(null, { status: 404 })
      }
      return new Response(null, {
        status: updateResult === "updated" ? 204 : 409,
      })
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
        const parsedPayload = activityTouchPayloadSchema.safeParse(payload)
        if (!parsedPayload.success) {
          return new Response(null, { status: 400 })
        }
        const touchedAt = parsedPayload.data.touchedAt
        const didUpdate = await this.state.storage.transaction(
          async (storage) => {
            const currentSession =
              await storage.get<StoredSession>(SESSION_STORAGE_KEY)
            if (!currentSession) {
              return false
            }
            await storage.put(SESSION_STORAGE_KEY, {
              ...currentSession,
              lastActivityTouchAt: Math.max(
                currentSession.lastActivityTouchAt ?? currentSession.createdAt,
                touchedAt
              ),
            } satisfies StoredSession)
            return true
          }
        )
        return new Response(null, { status: didUpdate ? 204 : 404 })
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
      const storedSession: StoredSession = {
        ...sealedRecord,
        instanceId: crypto.randomUUID(),
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
        revision: 0,
        issuanceGeneration: payload.issuanceGeneration,
      }
      const didCreate = await this.state.storage.transaction(
        async (storage) => {
          if (await storage.get(SESSION_STORAGE_KEY)) {
            return false
          }
          const issuance = await storage.get<StoredSessionIssuance>(
            SESSION_ISSUANCE_STORAGE_KEY
          )
          if (
            (issuance && issuance.generation !== payload.issuanceGeneration) ||
            (payload.issuanceGeneration !== undefined && !issuance)
          ) {
            return false
          }
          await storage.put(SESSION_STORAGE_KEY, storedSession)
          if (issuance) {
            await storage.delete(SESSION_ISSUANCE_STORAGE_KEY)
          }
          return true
        }
      )
      return new Response(null, { status: didCreate ? 204 : 409 })
    }
    if (request.method === "DELETE") {
      const issuanceGenerationParameter =
        url.searchParams.get("issuanceGeneration")
      const issuanceGeneration =
        issuanceGenerationParameter === null
          ? undefined
          : Number(issuanceGenerationParameter)
      if (
        issuanceGeneration !== undefined &&
        (!Number.isSafeInteger(issuanceGeneration) || issuanceGeneration <= 0)
      ) {
        return new Response(null, { status: 400 })
      }
      await this.state.storage.transaction(async (storage) => {
        if (issuanceGeneration !== undefined) {
          const [currentSession, currentIssuance] = await Promise.all([
            storage.get<StoredSession>(SESSION_STORAGE_KEY),
            storage.get<StoredSessionIssuance>(SESSION_ISSUANCE_STORAGE_KEY),
          ])
          if (
            (currentSession &&
              currentSession.issuanceGeneration !== issuanceGeneration) ||
            (currentIssuance &&
              currentIssuance.generation !== issuanceGeneration)
          ) {
            return
          }
        }
        await storage.delete([
          SESSION_STORAGE_KEY,
          SESSION_ISSUANCE_STORAGE_KEY,
        ])
      })
      return new Response(null, { status: 204 })
    }
    if (request.method === "GET" || request.method === "HEAD") {
      const nowParameter = url.searchParams.get("nowMs")
      const nowMs = nowParameter ? Number(nowParameter) : Date.now()
      if (!Number.isFinite(nowMs)) {
        return new Response(null, { status: 401 })
      }
      const initialSessionStatus = await this.state.storage.transaction(
        async (storage) => {
          const currentSession =
            await storage.get<StoredSession>(SESSION_STORAGE_KEY)
          if (!currentSession) {
            return { kind: "missing" } as const
          }
          if (
            nowMs >= currentSession.expiresAt ||
            nowMs >= currentSession.idleExpiresAt
          ) {
            await storage.delete(SESSION_STORAGE_KEY)
            return { kind: "expired" } as const
          }
          return { kind: "active", session: currentSession } as const
        }
      )
      if (initialSessionStatus.kind !== "active") {
        return new Response(null, {
          status: initialSessionStatus.kind === "expired" ? 401 : 404,
        })
      }
      if (request.method === "HEAD") {
        return new Response(null, { status: 204 })
      }
      const storedSession = initialSessionStatus.session
      const tokens = await this.readTokens(storedSession)
      if (tokens) {
        const sessionStatus = await this.state.storage.transaction(
          async (storage) => {
            const currentSession =
              await storage.get<StoredSession>(SESSION_STORAGE_KEY)
            if (!currentSession) {
              return "missing" as const
            }
            if (
              nowMs >= currentSession.expiresAt ||
              nowMs >= currentSession.idleExpiresAt
            ) {
              await storage.delete(SESSION_STORAGE_KEY)
              return "expired" as const
            }
            if (
              currentSession.instanceId !== storedSession.instanceId ||
              (currentSession.revision ?? 0) !== (storedSession.revision ?? 0)
            ) {
              return "conflict" as const
            }
            await storage.put(SESSION_STORAGE_KEY, {
              ...currentSession,
              idleExpiresAt: Math.max(
                currentSession.idleExpiresAt,
                Math.min(
                  nowMs + currentSession.idleTimeoutMs,
                  currentSession.expiresAt
                )
              ),
            } satisfies StoredSession)
            return "active" as const
          }
        )
        if (sessionStatus !== "active") {
          return new Response(null, {
            status:
              sessionStatus === "missing"
                ? 404
                : sessionStatus === "expired"
                  ? 401
                  : 409,
          })
        }
        return Response.json({
          convexSessionId: tokens.convexSessionId,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          createdAt: storedSession.createdAt,
          expiresAt: storedSession.expiresAt,
          issuanceGeneration: storedSession.issuanceGeneration,
        } satisfies SessionPayload)
      }
      return this.environment.AUTH_SESSION_ENCRYPTION_KEY
        ? new Response(null, { status: 422 })
        : Response.json(UNAVAILABLE_RESPONSE, { status: 503 })
    }
    return new Response(null, { status: 405 })
  }

  alarm = async (): Promise<void> => {
    const nowMs = Date.now()
    await this.state.storage.transaction(async (storage) => {
      const retentionExpiresAt = await storage.get<number>(
        SESSION_ISSUANCE_GENERATION_RETENTION_KEY
      )
      if (retentionExpiresAt !== undefined && retentionExpiresAt > nowMs) {
        await storage.setAlarm(retentionExpiresAt)
        return
      }
      await storage.delete([
        SESSION_ISSUANCE_STORAGE_KEY,
        SESSION_ISSUANCE_GENERATION_KEY,
        SESSION_ISSUANCE_GENERATION_RETENTION_KEY,
      ])
    })
  }
}
