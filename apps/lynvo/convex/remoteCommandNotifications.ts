import { env, mutation, query } from "./_generated/server"
import { v } from "convex/values"
import { REMOTE_COMMAND_NOTIFICATION_BATCH_SIZE } from "./constants"
import { verifyRemoteCommandNotificationToken } from "./authGateway"

const authorizeNotificationDelivery = async (serviceToken: string) => {
  const secret = env.AUTH_GATEWAY_SECRET
  if (!secret) {
    throw new Error("Remote command notification delivery is unavailable")
  }
  await verifyRemoteCommandNotificationToken(serviceToken, secret)
}

export const listPending = query({
  args: { serviceToken: v.string() },
  returns: v.array(
    v.object({
      commandId: v.string(),
      userId: v.id("users"),
      receiverId: v.string(),
    })
  ),
  handler: async (context, arguments_) => {
    await authorizeNotificationDelivery(arguments_.serviceToken)
    const commands = await context.db
      .query("remoteCommands")
      .withIndex("by_notificationPending_createdAt", (queryBuilder) =>
        queryBuilder.eq("notificationPending", true)
      )
      .order("asc")
      .take(REMOTE_COMMAND_NOTIFICATION_BATCH_SIZE)
    return commands.map((command) => ({
      commandId: command._id,
      userId: command.userId,
      receiverId: command.targetReceiverId,
    }))
  },
})

export const acknowledge = mutation({
  args: {
    serviceToken: v.string(),
    commandId: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (context, arguments_) => {
    await authorizeNotificationDelivery(arguments_.serviceToken)
    const commandId = context.db.normalizeId(
      "remoteCommands",
      arguments_.commandId
    )
    const command = commandId
      ? await context.db.get("remoteCommands", commandId)
      : null
    if (command?.notificationPending) {
      await context.db.patch("remoteCommands", command._id, {
        notificationPending: false,
      })
    }
    return { success: true }
  },
})
