import { v } from "convex/values"
import { getAuthSessionId } from "@convex-dev/auth/server"
import { internal } from "./_generated/api"
import { internalMutation, mutation, query } from "./_generated/server"
import { getAuthenticatedUserId } from "./authentication"
import {
  REMOTE_COMMAND_CLEANUP_BATCH_SIZE,
  REMOTE_COMMAND_MAX_PAYLOAD_BYTES,
  REMOTE_COMMAND_QUERY_LIMIT,
  REMOTE_COMMAND_TTL_MS,
} from "./constants"

const remoteCommandValidator = v.union(v.literal("play"), v.literal("pause"))

const getAuthenticatedSession = async (
  context: Parameters<typeof getAuthSessionId>[0]
) => {
  const sessionId = await getAuthSessionId(context)
  if (!sessionId) {
    throw new Error("Authentication session required")
  }
  return sessionId
}

const assertPayloadSize = (payload: string) => {
  if (
    new TextEncoder().encode(payload).byteLength >
    REMOTE_COMMAND_MAX_PAYLOAD_BYTES
  ) {
    throw new Error("Remote command payload is too large")
  }
}

export const enqueue = mutation({
  returns: v.any(),
  args: {
    targetSessionId: v.id("authSessions"),
    command: remoteCommandValidator,
    payload: v.string(),
  },
  handler: async (context, arguments_) => {
    const userId = await getAuthenticatedUserId(context)
    await getAuthenticatedSession(context)
    assertPayloadSize(arguments_.payload)
    const targetSession = await context.db.get(
      "authSessions",
      arguments_.targetSessionId
    )
    if (!targetSession || targetSession.userId !== userId) {
      throw new Error("Remote session not found")
    }
    const now = Date.now()
    return await context.db.insert("remoteCommands", {
      userId,
      targetSessionId: arguments_.targetSessionId,
      command: arguments_.command,
      payload: arguments_.payload,
      createdAt: now,
      expiresAt: now + REMOTE_COMMAND_TTL_MS,
    })
  },
})

export const listForCurrentSession = query({
  returns: v.any(),
  args: {},
  handler: async (context) => {
    const userId = await getAuthenticatedUserId(context)
    const sessionId = await getAuthenticatedSession(context)
    return await context.db
      .query("remoteCommands")
      .withIndex("by_userId_targetSessionId_createdAt", (queryBuilder) =>
        queryBuilder.eq("userId", userId).eq("targetSessionId", sessionId)
      )
      .order("asc")
      .take(REMOTE_COMMAND_QUERY_LIMIT)
  },
})

export const acknowledge = mutation({
  returns: v.any(),
  args: { id: v.id("remoteCommands") },
  handler: async (context, arguments_) => {
    const userId = await getAuthenticatedUserId(context)
    const sessionId = await getAuthenticatedSession(context)
    const command = await context.db.get("remoteCommands", arguments_.id)
    if (
      !command ||
      command.userId !== userId ||
      command.targetSessionId !== sessionId
    ) {
      throw new Error("Remote command not found")
    }
    await context.db.delete("remoteCommands", command._id)
    return { success: true }
  },
})

export const cleanupExpired = internalMutation({
  args: {},
  handler: async (context) => {
    const now = Date.now()
    const expiredCommands = await context.db
      .query("remoteCommands")
      .withIndex("by_expiresAt", (queryBuilder) =>
        queryBuilder.lt("expiresAt", now)
      )
      .take(REMOTE_COMMAND_CLEANUP_BATCH_SIZE)
    await Promise.all(
      expiredCommands.map((command) =>
        context.db.delete("remoteCommands", command._id)
      )
    )
    if (expiredCommands.length === REMOTE_COMMAND_CLEANUP_BATCH_SIZE) {
      await context.scheduler.runAfter(0, internal.commands.cleanupExpired, {})
    }
    return { deletedCount: expiredCommands.length }
  },
})
