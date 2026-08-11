import { v } from "convex/values"
import { getAuthSessionId } from "@convex-dev/auth/server"
import { internal } from "./_generated/api"
import { internalMutation, mutation } from "./_generated/server"
import { getAuthenticatedWritableUserId } from "./authentication"
import {
  REMOTE_COMMAND_CLEANUP_BATCH_SIZE,
  REMOTE_COMMAND_CLAIM_LEASE_MS,
  REMOTE_COMMAND_MAX_PAYLOAD_BYTES,
  REMOTE_COMMAND_TTL_MS,
} from "./constants"

const remoteCommandValidator = v.literal("play")
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
  returns: v.id("remoteCommands"),
  args: {
    targetSessionId: v.string(),
    command: remoteCommandValidator,
    payload: v.string(),
    targetReceiverId: v.string(),
  },
  handler: async (context, arguments_) => {
    const userId = await getAuthenticatedWritableUserId(context)
    await getAuthenticatedSession(context)
    assertPayloadSize(arguments_.payload)
    const targetSessionId = context.db.normalizeId(
      "authSessions",
      arguments_.targetSessionId
    )
    if (!targetSessionId) {
      throw new Error("Remote session not found")
    }
    const targetSession = await context.db.get("authSessions", targetSessionId)
    if (!targetSession || targetSession.userId !== userId) {
      throw new Error("Remote session not found")
    }
    const now = Date.now()
    return await context.db.insert("remoteCommands", {
      userId,
      targetSessionId,
      targetReceiverId: arguments_.targetReceiverId,
      command: arguments_.command,
      payload: arguments_.payload,
      createdAt: now,
      expiresAt: now + REMOTE_COMMAND_TTL_MS,
      status: "queued",
      availableAt: now,
      notificationPending: true,
    })
  },
})

export const claimNext = mutation({
  returns: v.union(
    v.null(),
    v.object({
      id: v.id("remoteCommands"),
      command: remoteCommandValidator,
      payload: v.string(),
      createdAt: v.number(),
      claimToken: v.string(),
    })
  ),
  args: { receiverId: v.string() },
  handler: async (context, arguments_) => {
    const [userId, sessionId] = await Promise.all([
      getAuthenticatedWritableUserId(context),
      getAuthenticatedSession(context),
    ])
    const now = Date.now()
    const findAvailableCommand = async (status: "queued" | "claimed") =>
      await context.db
        .query("remoteCommands")
        .withIndex("by_claim_availability", (queryBuilder) =>
          queryBuilder
            .eq("userId", userId)
            .eq("targetSessionId", sessionId)
            .eq("targetReceiverId", arguments_.receiverId)
            .eq("status", status)
            .lte("availableAt", now)
        )
        .order("asc")
        .filter((queryBuilder) =>
          queryBuilder.gt(queryBuilder.field("expiresAt"), now)
        )
        .first()
    const [queuedCommand, reclaimableCommand] = await Promise.all([
      findAvailableCommand("queued"),
      findAvailableCommand("claimed"),
    ])
    const command =
      queuedCommand && reclaimableCommand
        ? queuedCommand.createdAt <= reclaimableCommand.createdAt
          ? queuedCommand
          : reclaimableCommand
        : (queuedCommand ?? reclaimableCommand)
    if (!command) {
      return null
    }
    const claimToken = crypto.randomUUID()
    await context.db.patch("remoteCommands", command._id, {
      status: "claimed",
      claimToken,
      claimExpiresAt: now + REMOTE_COMMAND_CLAIM_LEASE_MS,
      availableAt: now + REMOTE_COMMAND_CLAIM_LEASE_MS,
    })
    return {
      id: command._id,
      command: command.command,
      payload: command.payload,
      createdAt: command.createdAt,
      claimToken,
    }
  },
})

export const reportResult = mutation({
  returns: v.object({ success: v.boolean() }),
  args: {
    id: v.string(),
    receiverId: v.string(),
    claimToken: v.string(),
    result: v.union(v.literal("applied"), v.literal("failed")),
    message: v.optional(v.string()),
  },
  handler: async (context, arguments_) => {
    const [userId, sessionId] = await Promise.all([
      getAuthenticatedWritableUserId(context),
      getAuthenticatedSession(context),
    ])
    const commandId = context.db.normalizeId("remoteCommands", arguments_.id)
    const command = commandId
      ? await context.db.get("remoteCommands", commandId)
      : null
    if (
      !command ||
      command.userId !== userId ||
      command.targetSessionId !== sessionId ||
      command.targetReceiverId !== arguments_.receiverId ||
      command.claimToken !== arguments_.claimToken
    ) {
      throw new Error("Remote command claim is no longer active")
    }
    if (command.status === arguments_.result) {
      return { success: true }
    }
    if (command.status !== "claimed") {
      throw new Error("Remote command claim is no longer active")
    }
    await context.db.patch("remoteCommands", command._id, {
      status: arguments_.result,
      resultMessage: arguments_.message,
      claimExpiresAt: undefined,
      availableAt: undefined,
    })
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
