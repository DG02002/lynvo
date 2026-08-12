import { v } from "convex/values"
import { internal } from "./_generated/api"
import { internalMutation, mutation, query } from "./_generated/server"
import {
  getAuthenticatedUserId,
  getAuthenticatedWritableUserId,
} from "./authentication"
import { getAuthSessionId } from "@convex-dev/auth/server"
import { verifyDeviceCodePreflightToken } from "./authGateway"
import {
  DEVICE_CODE_CLEANUP_BATCH_SIZE,
  DEVICE_CODE_EXCHANGE_LEASE_MS,
  DEVICE_CODE_TTL_MS,
  SESSION_TOTAL_DURATION_MS,
} from "./constants"
import { enqueueWorkerSessionCleanup } from "./sessionCleanup"
import { revokeUserSession } from "./accountLifecycle"

declare const process: {
  env: {
    AUTH_GATEWAY_SECRET?: string
  }
}

const DEVICE_CODE_LETTER_COUNT = 8
const DEVICE_CODE_GROUP_LENGTH = 4
const DEVICE_CODE_ALPHABET_SIZE = 26
const DEVICE_CODE_FIRST_LETTER_CODE_POINT = "A".charCodeAt(0)
const DEVICE_CODE_RANDOM_LIMIT =
  Math.floor(256 / DEVICE_CODE_ALPHABET_SIZE) * DEVICE_CODE_ALPHABET_SIZE
const DEVICE_CODE_COLLISION_ATTEMPTS = 5

const generateDeviceCode = () => {
  let letters = ""
  while (letters.length < DEVICE_CODE_LETTER_COUNT) {
    const randomValues = new Uint8Array(DEVICE_CODE_LETTER_COUNT)
    crypto.getRandomValues(randomValues)
    for (const randomValue of randomValues) {
      if (
        randomValue < DEVICE_CODE_RANDOM_LIMIT &&
        letters.length < DEVICE_CODE_LETTER_COUNT
      ) {
        letters += String.fromCharCode(
          DEVICE_CODE_FIRST_LETTER_CODE_POINT +
            (randomValue % DEVICE_CODE_ALPHABET_SIZE)
        )
      }
    }
  }
  return `${letters.slice(0, DEVICE_CODE_GROUP_LENGTH)}-${letters.slice(DEVICE_CODE_GROUP_LENGTH)}`
}

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")

const digestPollSecret = async (pollSecret: string) =>
  bytesToHex(
    new Uint8Array(
      await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(pollSecret)
      )
    )
  )

const generatePollSecret = () => {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return bytesToHex(bytes)
}

export const generateCode = mutation({
  returns: v.any(),
  args: {
    deviceName: v.string(),
    preflightToken: v.string(),
  },
  handler: async (context, arguments_) => {
    const secret = process.env.AUTH_GATEWAY_SECRET
    if (!secret) {
      throw new Error("Auth gateway is not configured")
    }
    await verifyDeviceCodePreflightToken(arguments_.preflightToken, secret)
    const now = Date.now()
    const deviceName =
      arguments_.deviceName.trim().slice(0, 80) || "Unknown device"
    let code: string | undefined
    for (
      let attempt = 0;
      attempt < DEVICE_CODE_COLLISION_ATTEMPTS;
      attempt += 1
    ) {
      const candidate = generateDeviceCode()
      const existing = await context.db
        .query("deviceCodes")
        .withIndex("by_code", (queryBuilder) =>
          queryBuilder.eq("code", candidate)
        )
        .unique()
      if (!existing) {
        code = candidate
        break
      }
    }
    if (!code) {
      throw new Error("Unable to allocate a device code")
    }
    const pollSecret = generatePollSecret()
    const expiresAt = now + DEVICE_CODE_TTL_MS
    await context.db.insert("deviceCodes", {
      code,
      pollSecretDigest: await digestPollSecret(pollSecret),
      status: "pending",
      deviceName,
      expiresAt,
      createdAt: now,
    })
    console.info("security.qr_code_generated")
    return { code, pollSecret, expiresAt, deviceName }
  },
})

export const getStatus = query({
  returns: v.any(),
  args: { code: v.string(), pollSecret: v.string() },
  handler: async (context, arguments_) => {
    const record = await context.db
      .query("deviceCodes")
      .withIndex("by_code", (queryBuilder) =>
        queryBuilder.eq("code", arguments_.code)
      )
      .unique()
    if (
      !record ||
      record.pollSecretDigest !==
        (await digestPollSecret(arguments_.pollSecret))
    ) {
      return { status: "invalid" }
    }
    return {
      status: record.status === "exchanging" ? "authorized" : record.status,
      deviceName: record.deviceName,
      expiresAt: record.expiresAt,
    }
  },
})

export const getCodeForApproval = query({
  returns: v.any(),
  args: { code: v.string() },
  handler: async (context, arguments_) => {
    await getAuthenticatedUserId(context)
    const record = await context.db
      .query("deviceCodes")
      .withIndex("by_code", (queryBuilder) =>
        queryBuilder.eq("code", arguments_.code)
      )
      .unique()
    if (!record) {
      return null
    }
    return {
      code: record.code,
      status: record.status,
      deviceName: record.deviceName,
      expiresAt: record.expiresAt,
    }
  },
})

export const authorizeCode = mutation({
  returns: v.any(),
  args: { code: v.string() },
  handler: async (context, arguments_) => {
    const userId = await getAuthenticatedWritableUserId(context)
    const record = await context.db
      .query("deviceCodes")
      .withIndex("by_code", (queryBuilder) =>
        queryBuilder.eq("code", arguments_.code)
      )
      .unique()
    if (!record) {
      throw new Error("Enter the code shown on the device")
    }
    if (record.status !== "pending" || Date.now() >= record.expiresAt) {
      throw new Error("This code was used or has expired. Generate a new code.")
    }
    await context.db.patch("deviceCodes", record._id, {
      status: "authorized",
      userId,
    })
    console.info("security.qr_code_approved", { userId })
    return { success: true }
  },
})

export const claimAuthorizedCode = internalMutation({
  args: {
    code: v.string(),
    pollSecret: v.string(),
    now: v.number(),
    attemptId: v.string(),
    generation: v.number(),
  },
  handler: async (context, arguments_) => {
    const record = await context.db
      .query("deviceCodes")
      .withIndex("by_code", (queryBuilder) =>
        queryBuilder.eq("code", arguments_.code)
      )
      .unique()
    const isSameActiveAttempt =
      record?.status === "exchanging" &&
      record.exchangeAttemptId === arguments_.attemptId
    const isStaleGeneration =
      record?.exchangeAttemptId === arguments_.attemptId &&
      record.exchangeGeneration !== undefined &&
      arguments_.generation <= record.exchangeGeneration
    if (
      !record ||
      (record.status !== "authorized" &&
        !(
          record.status === "exchanging" &&
          (isSameActiveAttempt ||
            (record.exchangeLeaseExpiresAt !== undefined &&
              record.exchangeLeaseExpiresAt <= arguments_.now))
        )) ||
      !record.userId ||
      isStaleGeneration ||
      arguments_.now >= record.expiresAt ||
      record.pollSecretDigest !==
        (await digestPollSecret(arguments_.pollSecret))
    ) {
      throw new Error("Approve this code on the signed-in device")
    }
    let sessionId = record.exchangeSessionId
    if (isSameActiveAttempt && sessionId) {
      const existingSessionId = sessionId
      const session = await context.db.get("authSessions", existingSessionId)
      if (
        !session ||
        session.userId !== record.userId ||
        session.deviceExchangeAttemptId !== arguments_.attemptId ||
        session.workerSessionId
      ) {
        throw new Error("Device code exchange session is invalid")
      }
      const refreshTokens = await context.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (queryBuilder) =>
          queryBuilder.eq("sessionId", existingSessionId)
        )
        .collect()
      await Promise.all(
        refreshTokens.map((refreshToken) =>
          context.db.delete("authRefreshTokens", refreshToken._id)
        )
      )
    } else {
      if (
        record.status === "exchanging" &&
        record.exchangeAttemptId &&
        record.exchangeSessionId
      ) {
        const supersededSession = await context.db.get(
          "authSessions",
          record.exchangeSessionId
        )
        if (
          supersededSession?.userId === record.userId &&
          supersededSession.deviceExchangeAttemptId === record.exchangeAttemptId
        ) {
          await enqueueWorkerSessionCleanup(
            context,
            [record.exchangeAttemptId],
            record.exchangeGeneration
          )
          await revokeUserSession(
            context,
            record.userId,
            null,
            supersededSession._id
          )
        }
      }
      sessionId = await context.db.insert("authSessions", {
        userId: record.userId,
        expirationTime: arguments_.now + SESSION_TOTAL_DURATION_MS,
        deviceExchangeAttemptId: arguments_.attemptId,
      })
    }
    await context.db.patch("deviceCodes", record._id, {
      status: "exchanging",
      exchangeAttemptId: arguments_.attemptId,
      exchangeGeneration: arguments_.generation,
      exchangeLeaseExpiresAt: arguments_.now + DEVICE_CODE_EXCHANGE_LEASE_MS,
      exchangeSessionId: sessionId,
    })
    return { userId: record.userId, deviceName: record.deviceName, sessionId }
  },
})

export const commitExchangeIssuance = mutation({
  returns: v.union(v.literal("current"), v.literal("stale")),
  args: {
    code: v.string(),
    attemptId: v.string(),
    generation: v.number(),
    refreshTokenId: v.string(),
  },
  handler: async (context, arguments_) => {
    const userId = await getAuthenticatedWritableUserId(context)
    const currentSessionId = await getAuthSessionId(context)
    const refreshTokenId = context.db.normalizeId(
      "authRefreshTokens",
      arguments_.refreshTokenId
    )
    if (!currentSessionId || !refreshTokenId) {
      throw new Error("Device exchange credentials are invalid")
    }
    const [record, session, issuedRefreshToken] = await Promise.all([
      context.db
        .query("deviceCodes")
        .withIndex("by_code", (queryBuilder) =>
          queryBuilder.eq("code", arguments_.code)
        )
        .unique(),
      context.db.get("authSessions", currentSessionId),
      context.db.get("authRefreshTokens", refreshTokenId),
    ])
    if (
      !session ||
      session.userId !== userId ||
      session.deviceExchangeAttemptId !== arguments_.attemptId ||
      !issuedRefreshToken ||
      issuedRefreshToken.sessionId !== currentSessionId
    ) {
      throw new Error("Device exchange credentials are invalid")
    }
    if (
      !record ||
      record.userId !== userId ||
      record.status !== "exchanging" ||
      record.exchangeAttemptId !== arguments_.attemptId ||
      record.exchangeSessionId !== currentSessionId ||
      record.exchangeGeneration !== arguments_.generation
    ) {
      await context.db.delete("authRefreshTokens", refreshTokenId)
      return "stale"
    }
    const refreshTokens = await context.db
      .query("authRefreshTokens")
      .withIndex("sessionId", (queryBuilder) =>
        queryBuilder.eq("sessionId", currentSessionId)
      )
      .collect()
    await Promise.all(
      refreshTokens.flatMap((refreshToken) =>
        refreshToken._id === refreshTokenId
          ? []
          : [context.db.delete("authRefreshTokens", refreshToken._id)]
      )
    )
    return "current"
  },
})

export const finalizeExchange = mutation({
  returns: v.null(),
  args: {
    code: v.string(),
    pollSecret: v.string(),
    attemptId: v.string(),
    sessionId: v.string(),
    generation: v.number(),
  },
  handler: async (context, arguments_) => {
    const userId = await getAuthenticatedWritableUserId(context)
    const currentSessionId = await getAuthSessionId(context)
    const record = await context.db
      .query("deviceCodes")
      .withIndex("by_code", (queryBuilder) =>
        queryBuilder.eq("code", arguments_.code)
      )
      .unique()
    if (
      !record ||
      !currentSessionId ||
      record.userId !== userId ||
      currentSessionId !== arguments_.sessionId ||
      record.exchangeSessionId !== currentSessionId ||
      record.pollSecretDigest !==
        (await digestPollSecret(arguments_.pollSecret)) ||
      record.exchangeAttemptId !== arguments_.attemptId ||
      record.exchangeGeneration !== arguments_.generation
    ) {
      throw new Error("Device code exchange was superseded")
    }
    if (
      record.status === "consumed" &&
      record.consumedSessionId === currentSessionId
    ) {
      return null
    }
    if (record.status !== "exchanging") {
      throw new Error("Device code exchange is not active")
    }
    await context.db.patch("deviceCodes", record._id, {
      status: "consumed",
      consumedSessionId: currentSessionId,
      exchangeLeaseExpiresAt: undefined,
    })
    console.info("security.qr_code_exchanged", { userId })
    return null
  },
})

export const recoverExchange = query({
  returns: v.union(
    v.literal("resumable"),
    v.literal("completed"),
    v.literal("superseded"),
    v.literal("invalid")
  ),
  args: {
    code: v.string(),
    pollSecret: v.string(),
    attemptId: v.string(),
  },
  handler: async (context, arguments_) => {
    const userId = await getAuthenticatedUserId(context)
    const currentSessionId = await getAuthSessionId(context)
    const [record, session] = await Promise.all([
      context.db
        .query("deviceCodes")
        .withIndex("by_code", (queryBuilder) =>
          queryBuilder.eq("code", arguments_.code)
        )
        .unique(),
      currentSessionId
        ? context.db.get("authSessions", currentSessionId)
        : null,
    ])
    if (
      !record ||
      !currentSessionId ||
      !session ||
      record.userId !== userId ||
      record.exchangeSessionId !== currentSessionId ||
      record.pollSecretDigest !==
        (await digestPollSecret(arguments_.pollSecret)) ||
      session.userId !== userId
    ) {
      return "invalid"
    }
    if (record.exchangeAttemptId !== arguments_.attemptId) {
      return "superseded"
    }
    if (
      record.status === "consumed" &&
      record.consumedSessionId === currentSessionId &&
      session.workerSessionId === arguments_.attemptId
    ) {
      return "completed"
    }
    if (
      record.status === "exchanging" &&
      (!session.workerSessionId ||
        session.workerSessionId === arguments_.attemptId)
    ) {
      return "resumable"
    }
    return "invalid"
  },
})

export const abortDeviceExchange = mutation({
  returns: v.null(),
  args: {
    code: v.string(),
    attemptId: v.string(),
    sessionId: v.string(),
    generation: v.number(),
  },
  handler: async (context, arguments_) => {
    const userId = await getAuthenticatedWritableUserId(context)
    const currentSessionId = await getAuthSessionId(context)
    const sessionId = context.db.normalizeId(
      "authSessions",
      arguments_.sessionId
    )
    if (!currentSessionId || !sessionId || currentSessionId !== sessionId) {
      throw new Error("Device code exchange session is invalid")
    }
    const [record, session] = await Promise.all([
      context.db
        .query("deviceCodes")
        .withIndex("by_code", (queryBuilder) =>
          queryBuilder.eq("code", arguments_.code)
        )
        .unique(),
      context.db.get("authSessions", sessionId),
    ])
    if (
      !session ||
      session.userId !== userId ||
      session.deviceExchangeAttemptId !== arguments_.attemptId
    ) {
      throw new Error("Device code exchange session is invalid")
    }
    if (
      record?.userId === userId &&
      record.exchangeAttemptId === arguments_.attemptId &&
      record.exchangeSessionId === sessionId &&
      record.exchangeGeneration !== arguments_.generation
    ) {
      return null
    }
    if (
      record?.userId === userId &&
      record.exchangeAttemptId === arguments_.attemptId &&
      record.exchangeSessionId === sessionId
    ) {
      await context.db.patch("deviceCodes", record._id, {
        status: "authorized",
        exchangeLeaseExpiresAt: undefined,
        exchangeSessionId: undefined,
        consumedSessionId: undefined,
      })
    }
    await enqueueWorkerSessionCleanup(
      context,
      [arguments_.attemptId],
      arguments_.generation
    )
    await revokeUserSession(context, userId, null, sessionId)
    return null
  },
})

export const cleanupExpiredCodes = internalMutation({
  args: {},
  handler: async (context) => {
    const expiredCodes = await context.db
      .query("deviceCodes")
      .withIndex("by_expiresAt", (queryBuilder) =>
        queryBuilder.lt("expiresAt", Date.now())
      )
      .take(DEVICE_CODE_CLEANUP_BATCH_SIZE)
    await Promise.all(
      expiredCodes.map(async (record) => {
        if (record.status !== "consumed") {
          if (record.exchangeAttemptId) {
            await enqueueWorkerSessionCleanup(
              context,
              [record.exchangeAttemptId],
              record.exchangeGeneration
            )
          }
          if (record.exchangeSessionId) {
            const session = await context.db.get(
              "authSessions",
              record.exchangeSessionId
            )
            if (
              session &&
              session.userId === record.userId &&
              session.deviceExchangeAttemptId === record.exchangeAttemptId
            ) {
              await revokeUserSession(
                context,
                session.userId,
                null,
                session._id
              )
            }
          }
        }
        await context.db.delete("deviceCodes", record._id)
      })
    )
    if (expiredCodes.length === DEVICE_CODE_CLEANUP_BATCH_SIZE) {
      await context.scheduler.runAfter(
        0,
        internal.deviceAuth.cleanupExpiredCodes,
        {}
      )
    }
    return { deleted: expiredCodes.length }
  },
})
