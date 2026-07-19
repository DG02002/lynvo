import { mutation, query, internalMutation } from "./_generated/server"
import { v } from "convex/values"

// Push a command from the phone controller targeting a TV session
export const push = mutation({
  args: {
    targetSessionId: v.string(),
    command: v.string(),
    payload: v.string(), // JSON string or raw payload
  },
  handler: async (ctx, args) => {
    // Optional: We can check user identity if needed, but since TV commands are scoped
    // by targetSessionId, we allow pushing to it.
    const now = Date.now()
    return await ctx.db.insert("commands", {
      targetSessionId: args.targetSessionId,
      command: args.command,
      payload: args.payload,
      createdAt: now,
    })
  },
})

// Query pending commands for a specific TV session (subscribed to by the TV client)
export const listPending = query({
  args: { targetSessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("commands")
      .withIndex("by_targetSessionId_createdAt", (q) =>
        q.eq("targetSessionId", args.targetSessionId)
      )
      .order("asc")
      .collect()
  },
})

// Delete commands after they have been processed by the TV client to prevent bloat
export const deleteCommands = mutation({
  args: { ids: v.array(v.id("commands")) },
  handler: async (ctx, args) => {
    await Promise.all(args.ids.map((commandId) => ctx.db.delete(commandId)))
    return { success: true }
  },
})

// Internal mutation to clean up commands older than 5 minutes
export const cleanupOldCommands = internalMutation({
  args: {},
  handler: async (ctx) => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    const oldCommands = await ctx.db.query("commands").collect()

    const expiredCommands = oldCommands.filter(
      (command) => command.createdAt < fiveMinutesAgo
    )
    await Promise.all(
      expiredCommands.map((command) => ctx.db.delete(command._id))
    )
    return { deletedCount: expiredCommands.length }
  },
})
