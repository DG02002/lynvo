import { internalMutation, mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { getAuthenticatedUserId } from "./authentication"

const CODE_TTL_MS = 10 * 60 * 1000

const generateNumericCode = () =>
  Math.floor(10000000 + Math.random() * 90000000).toString()

export const generateCode = mutation({
  args: {
    deviceName: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const deviceName = args.deviceName.trim().slice(0, 80) || "Unknown Device"
    let code = generateNumericCode()
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const existing = await ctx.db
        .query("deviceCodes")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique()
      if (!existing) {
        break
      }
      code = generateNumericCode()
    }
    const expiresAt = now + CODE_TTL_MS
    await ctx.db.insert("deviceCodes", {
      code,
      status: "pending",
      deviceName,
      expiresAt,
      createdAt: now,
    })
    console.info("security.qr_code_generated")
    return { code, expiresAt, deviceName }
  },
})

export const getStatus = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("deviceCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique()
    if (!record) {
      return { status: "invalid" as const }
    }
    if (Date.now() > record.expiresAt) {
      return { status: "expired" as const }
    }
    return {
      status: record.status,
      deviceName: record.deviceName,
    }
  },
})

export const getCodeForApproval = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    await getAuthenticatedUserId(ctx)
    const record = await ctx.db
      .query("deviceCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique()
    if (!record || Date.now() > record.expiresAt) {
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
  args: {
    code: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthenticatedUserId(ctx)
    const record = await ctx.db
      .query("deviceCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique()
    if (!record) {
      throw new Error("Enter the code shown on the device")
    }
    if (record.status !== "pending" || Date.now() > record.expiresAt) {
      throw new Error("This code was used or has expired. Generate a new code.")
    }
    await ctx.db.patch(record._id, {
      status: "authorized",
      userId,
    })
    console.info("security.qr_code_approved", { userId })
    return { success: true }
  },
})

export const getAuthorizedCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("deviceCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique()
    if (
      !record ||
      record.status !== "authorized" ||
      !record.userId ||
      Date.now() > record.expiresAt
    ) {
      return null
    }
    return {
      _id: record._id,
      userId: record.userId,
      deviceName: record.deviceName,
    }
  },
})

export const consumeCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("deviceCodes")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique()
    if (!record || record.status !== "authorized") {
      throw new Error("Approve this code on the signed-in device")
    }
    await ctx.db.patch(record._id, { status: "consumed" })
    console.info("security.qr_code_exchanged", { userId: record.userId })
    return {
      success: true,
      deviceName: record.deviceName,
    }
  },
})

export const cleanupExpiredCodes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const expired = await ctx.db
      .query("deviceCodes")
      .withIndex("by_expiresAt", (q) => q.lt("expiresAt", Date.now()))
      .collect()
    await Promise.all(expired.map((record) => ctx.db.delete(record._id)))
    return { deleted: expired.length }
  },
})
