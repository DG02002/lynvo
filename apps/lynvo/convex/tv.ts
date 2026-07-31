import { v } from "convex/values"
import { internal } from "./_generated/api"
import { internalMutation, mutation, query } from "./_generated/server"
import { getAuthenticatedUserId } from "./authentication"
import { verifyDeviceCodePreflightToken } from "./authGateway"
import { DEVICE_CODE_CLEANUP_BATCH_SIZE, DEVICE_CODE_TTL_MS } from "./constants"

declare const process: {
  env: {
    AUTH_GATEWAY_SECRET?: string
  }
}

const DEVICE_CODE_MINIMUM = 10_000_000
const DEVICE_CODE_RANGE = 90_000_000
const UINT32_RANGE = 0x1_0000_0000
const DEVICE_CODE_RANDOM_LIMIT =
  Math.floor(UINT32_RANGE / DEVICE_CODE_RANGE) * DEVICE_CODE_RANGE
const DEVICE_CODE_COLLISION_ATTEMPTS = 5

const generateNumericCode = () => {
  const randomValue = new Uint32Array(1)
  do {
    crypto.getRandomValues(randomValue)
  } while (randomValue[0] >= DEVICE_CODE_RANDOM_LIMIT)
  return (DEVICE_CODE_MINIMUM + (randomValue[0] % DEVICE_CODE_RANGE)).toString()
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
      const candidate = generateNumericCode()
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
      status: record.status,
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
    const userId = await getAuthenticatedUserId(context)
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

export const consumeAuthorizedCode = internalMutation({
  args: {
    code: v.string(),
    pollSecret: v.string(),
    now: v.number(),
  },
  handler: async (context, arguments_) => {
    const record = await context.db
      .query("deviceCodes")
      .withIndex("by_code", (queryBuilder) =>
        queryBuilder.eq("code", arguments_.code)
      )
      .unique()
    if (
      !record ||
      record.status !== "authorized" ||
      !record.userId ||
      arguments_.now >= record.expiresAt ||
      record.pollSecretDigest !==
        (await digestPollSecret(arguments_.pollSecret))
    ) {
      throw new Error("Approve this code on the signed-in device")
    }
    await context.db.patch("deviceCodes", record._id, { status: "consumed" })
    console.info("security.qr_code_exchanged", { userId: record.userId })
    return { userId: record.userId, deviceName: record.deviceName }
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
      expiredCodes.map((record) => context.db.delete("deviceCodes", record._id))
    )
    if (expiredCodes.length === DEVICE_CODE_CLEANUP_BATCH_SIZE) {
      await context.scheduler.runAfter(0, internal.tv.cleanupExpiredCodes, {})
    }
    return { deleted: expiredCodes.length }
  },
})
