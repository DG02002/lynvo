import { DurableObject } from "cloudflare:workers"
import { Result, Schema } from "effect"
import type { Context as HonoContext } from "hono"
import {
  dataChangedRequestSchema,
  receiverAttachmentSchema,
  receiverNotificationRequestSchema,
  sessionRevocationRequestSchema,
  type DataChangedRealtimeMessage,
  type RemoteInboxChangedRealtimeMessage,
  type SessionHelloRealtimeMessage,
} from "~shared/realtime-messages"

import { REALTIME_SESSION_REVOKED_CLOSE_CODE } from "../../app/lib/constants"
import { createRemoteTargetId } from "../../app/lib/remote-target"
import { checkRateLimit } from "../authentication-rate-limit"
import {
  EXTRACTION_ROUTE_RATE_LIMIT,
  EXTRACTION_ROUTE_RATE_WINDOW_SECONDS,
  REALTIME_SESSION_REVALIDATION_INTERVAL_MS,
} from "../constants"
import { getDataVersion } from "../d1/data-version"
import { getD1Database } from "../d1/db"
import { findActiveSessionForEnvironment } from "../d1/sessions"
import { getClientIp } from "../request-client-ip"
import {
  recordRateLimitResult,
  type RequestLoggingEnvironment,
} from "../request-logging"
import { isSameOriginRequest } from "../same-origin"

const rateLimit = checkRateLimit

interface RealtimeForwardHeadersInput {
  request: Request
  session: {
    readonly userId: string
    readonly sessionId: string
  }
  receiverId: string | undefined
  deviceName: string | undefined
}

export const buildRealtimeForwardHeaders = ({
  request,
  session,
  receiverId,
  deviceName,
}: RealtimeForwardHeadersInput): Headers => {
  const headers = new Headers(request.headers)
  headers.set("X-Lynvo-Session-Id", session.sessionId)
  headers.set("X-Lynvo-User-Id", session.userId)
  if (receiverId) {
    headers.set("X-Lynvo-Receiver-Id", receiverId)
    headers.set("X-Lynvo-Receiver-Name", deviceName || "Unnamed device")
  }
  return headers
}

export const createRealtimeHandshakeRejection = async (
  context: HonoContext<RequestLoggingEnvironment>
): Promise<Response | undefined> => {
  const request = context.req.raw
  if (request.headers.get("Upgrade") !== "websocket") {
    return context.text("Expected WebSocket", 426)
  }
  if (!isSameOriginRequest(request)) {
    return context.text("Forbidden", 403)
  }
  const handshakeRateLimit = await rateLimit({
    environment: context.env,
    key: `realtime:${getClientIp(request)}`,
    limit: EXTRACTION_ROUTE_RATE_LIMIT,
    windowSeconds: EXTRACTION_ROUTE_RATE_WINDOW_SECONDS,
  })
  if (handshakeRateLimit.status === "limited") {
    const retryAfterSeconds =
      handshakeRateLimit.expiresAt === undefined
        ? undefined
        : Math.max(
            0,
            Math.ceil((handshakeRateLimit.expiresAt - Date.now()) / 1_000)
          )
    recordRateLimitResult(context, handshakeRateLimit, retryAfterSeconds)
    if (retryAfterSeconds !== undefined) {
      context.header("Retry-After", String(retryAfterSeconds))
    }
    return context.text("Too many connection attempts", 429)
  }
  if (handshakeRateLimit.status === "unavailable") {
    recordRateLimitResult(context, handshakeRateLimit)
  }
  return undefined
}

interface RealtimeWebSocketSession {
  sessionId: string
  userId: string
  receiverId: string
  deviceName: string
}

const handleRealtimeDataChanged = async (
  context: DurableObjectState,
  request: Request
): Promise<Response> => {
  const input = Schema.decodeUnknownResult(dataChangedRequestSchema)(
    await request.json()
  )
  if (Result.isFailure(input)) {
    return new Response("Invalid data version", { status: 400 })
  }
  const message: DataChangedRealtimeMessage = {
    type: "data-changed",
    payload: { version: input.success.version },
  }
  const serialized = JSON.stringify(message)
  const sockets = context.getWebSockets()
  for (const socket of sockets) {
    socket.send(serialized)
  }
  return Response.json({ deliveredSocketCount: sockets.length })
}

const handleRealtimeInboxNotification = async (
  context: DurableObjectState,
  request: Request
): Promise<Response> => {
  const input = Schema.decodeUnknownResult(receiverNotificationRequestSchema)(
    await request.json()
  )
  if (Result.isFailure(input)) {
    return new Response("Invalid receiver", { status: 400 })
  }
  const message: RemoteInboxChangedRealtimeMessage = {
    type: "remote-inbox.changed",
    payload: {},
  }
  const serialized = JSON.stringify(message)
  const sockets = context.getWebSockets(input.success.receiverId)
  for (const socket of sockets) {
    socket.send(serialized)
  }
  return Response.json({ deliveredSocketCount: sockets.length })
}

const handleRealtimeSessionRevocation = async (
  context: DurableObjectState,
  request: Request
): Promise<Response> => {
  const input = Schema.decodeUnknownResult(sessionRevocationRequestSchema)(
    await request.json()
  )
  if (Result.isFailure(input)) {
    return new Response("Invalid session", { status: 400 })
  }
  for (const socket of context.getWebSockets(input.success.sessionId)) {
    socket.close(REALTIME_SESSION_REVOKED_CLOSE_CODE, "Session revoked")
  }
  return Response.json({ success: true })
}

const handleRealtimeAccountRevocation = (
  context: DurableObjectState
): Response => {
  for (const socket of context.getWebSockets()) {
    socket.close(
      REALTIME_SESSION_REVOKED_CLOSE_CODE,
      "Account sessions revoked"
    )
  }
  return Response.json({ success: true })
}

const handleRealtimeReceivers = (context: DurableObjectState): Response => {
  const receivers = context.getWebSockets().flatMap((socket) => {
    const attachment = Schema.decodeUnknownResult(receiverAttachmentSchema)(
      socket.deserializeAttachment()
    )
    if (Result.isFailure(attachment)) {
      return []
    }
    return [
      {
        id: createRemoteTargetId(
          attachment.success.sessionId,
          attachment.success.receiverId
        ),
        receiverId: attachment.success.receiverId,
        deviceName: attachment.success.deviceName,
        lastActiveAt: attachment.success.connectedAt,
      },
    ]
  })
  return Response.json({ receivers })
}

const readRealtimeWebSocketSession = (
  request: Request
): RealtimeWebSocketSession | undefined => {
  const sessionId = request.headers.get("X-Lynvo-Session-Id")
  const userId = request.headers.get("X-Lynvo-User-Id")
  const receiverId = request.headers.get("X-Lynvo-Receiver-Id")
  const deviceName = request.headers.get("X-Lynvo-Receiver-Name")
  if (!sessionId || !userId || !receiverId || !deviceName) {
    return undefined
  }
  return { sessionId, userId, receiverId, deviceName }
}

const configureRealtimeWebSocket = (
  context: DurableObjectState,
  server: WebSocket,
  session: RealtimeWebSocketSession
): void => {
  for (const existingSocket of context.getWebSockets(session.receiverId)) {
    existingSocket.close(1000, "Receiver replaced")
  }
  server.serializeAttachment({
    sessionId: session.sessionId,
    receiverId: session.receiverId,
    deviceName: session.deviceName,
    connectedAt: Date.now(),
  })
  context.acceptWebSocket(server, [session.sessionId, session.receiverId])
}

const readRealtimeDataVersion = async (
  env: Env,
  userId: string
): Promise<number | undefined> => {
  const database = getD1Database(env)
  if (!database) {
    return undefined
  }
  try {
    const dataVersion = await getDataVersion(database, userId)
    return dataVersion > 0 ? dataVersion : undefined
  } catch {
    return undefined
  }
}

const sendRealtimeSessionHello = (
  server: WebSocket,
  session: RealtimeWebSocketSession,
  dataVersion: number | undefined
): void => {
  const helloPayload: SessionHelloRealtimeMessage =
    dataVersion === undefined
      ? {
          type: "session_hello",
          userId: session.userId,
          sessionId: session.sessionId,
        }
      : {
          type: "session_hello",
          userId: session.userId,
          sessionId: session.sessionId,
          dataVersion,
        }
  server.send(JSON.stringify(helloPayload))
}

const scheduleRealtimeSessionAlarm = async (
  storage: DurableObjectStorage
): Promise<void> => {
  const nextAlarmAt = Date.now() + REALTIME_SESSION_REVALIDATION_INTERVAL_MS
  const existingAlarmAt = await storage.getAlarm()
  if (existingAlarmAt === null || existingAlarmAt > nextAlarmAt) {
    await storage.setAlarm(nextAlarmAt)
  }
}

const acceptRealtimeWebSocket = async (
  context: DurableObjectState,
  env: Env,
  request: Request
): Promise<Response> => {
  const pair = new WebSocketPair()
  const [client, server] = Object.values(pair)
  const session = readRealtimeWebSocketSession(request)
  if (!session) {
    return new Response("Missing session", { status: 401 })
  }
  configureRealtimeWebSocket(context, server, session)
  const dataVersion = await readRealtimeDataVersion(env, session.userId)
  sendRealtimeSessionHello(server, session, dataVersion)
  await scheduleRealtimeSessionAlarm(context.storage)
  return new Response(null, { status: 101, webSocket: client })
}

export class UserRealtimeRoom extends DurableObject<Env> {
  constructor(context: DurableObjectState, env: Env) {
    super(context, env)
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong")
    )
  }

  override async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url)
    if (pathname.endsWith("/notify-data-changed")) {
      return handleRealtimeDataChanged(this.ctx, request)
    }
    if (pathname.endsWith("/notify-inbox")) {
      return handleRealtimeInboxNotification(this.ctx, request)
    }
    if (pathname.endsWith("/revoke-session")) {
      return handleRealtimeSessionRevocation(this.ctx, request)
    }
    if (pathname.endsWith("/revoke-account")) {
      return handleRealtimeAccountRevocation(this.ctx)
    }
    if (pathname.endsWith("/receivers")) {
      return handleRealtimeReceivers(this.ctx)
    }
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 })
    }
    return acceptRealtimeWebSocket(this.ctx, this.env, request)
  }

  override async alarm(): Promise<void> {
    const database = getD1Database(this.env)
    try {
      if (database) {
        await Promise.all(
          this.ctx.getWebSockets().map(async (socket) => {
            try {
              const attachment = Schema.decodeUnknownResult(
                receiverAttachmentSchema
              )(socket.deserializeAttachment())
              if (Result.isFailure(attachment)) {
                socket.close(
                  REALTIME_SESSION_REVOKED_CLOSE_CODE,
                  "Session invalid"
                )
                return
              }
              const activeSession = await findActiveSessionForEnvironment({
                database,
                sessionId: attachment.success.sessionId,
                now: Date.now(),
                environment: this.env,
              })
              if (!activeSession) {
                socket.close(
                  REALTIME_SESSION_REVOKED_CLOSE_CODE,
                  "Session expired"
                )
              }
            } catch {
              return
            }
          })
        )
      }
    } finally {
      if (this.ctx.getWebSockets().length > 0) {
        await this.ctx.storage.setAlarm(
          Date.now() + REALTIME_SESSION_REVALIDATION_INTERVAL_MS
        )
      }
    }
  }

  override async webSocketMessage(
    socket: WebSocket,
    message: string | ArrayBuffer
  ): Promise<void> {
    const textMessage = Schema.decodeUnknownResult(Schema.String)(message)
    if (Result.isFailure(textMessage)) {
      return
    }
    socket.close(1003, "Unsupported message")
  }

  override webSocketClose(): void {}

  override webSocketError(socket: WebSocket): void {
    socket.close(1011, "WebSocket error")
  }
}
