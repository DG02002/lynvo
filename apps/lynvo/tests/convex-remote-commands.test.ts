// @vitest-environment edge-runtime

import { api, internal } from "../convex/_generated/api"
import {
  REMOTE_COMMAND_CLEANUP_BATCH_SIZE,
  REMOTE_COMMAND_MAX_PAYLOAD_BYTES,
  REMOTE_COMMAND_QUERY_LIMIT,
  REMOTE_COMMAND_TTL_MS,
} from "../convex/constants"
import {
  asAuthenticatedUser,
  createConvexTest,
  insertTestUser,
} from "./convex-test-harness"

describe("authenticated remote commands", () => {
  it("rejects anonymous enqueue and claim calls", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "anonymous-target")

    await expect(
      convex.mutation(api.commands.enqueue, {
        targetSessionId: user.sessionId,
        command: "play",
        payload: "{}",
        targetReceiverId: "receiver",
      })
    ).rejects.toThrow("UNAUTHORIZED")
    await expect(
      convex.mutation(api.commands.claimNext, { receiverId: "receiver" })
    ).rejects.toThrow("Authentication session required")
  })

  it("prevents a user from targeting another user's session", async () => {
    const convex = createConvexTest()
    const sender = await insertTestUser(convex, "sender")
    const target = await insertTestUser(convex, "target")
    const senderClient = asAuthenticatedUser(
      convex,
      sender.userId,
      sender.sessionId
    )

    await expect(
      senderClient.mutation(api.commands.enqueue, {
        targetSessionId: target.sessionId,
        command: "play",
        payload: "{}",
        targetReceiverId: "receiver",
      })
    ).rejects.toThrow("Remote session not found")
  })

  it("claims commands only for the targeted session and receiver", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "multi-session")
    const secondSessionId = await convex.run(
      async (context) =>
        await context.db.insert("authSessions", {
          userId: user.userId,
          expirationTime: Date.now() + REMOTE_COMMAND_TTL_MS,
        })
    )
    const senderClient = asAuthenticatedUser(
      convex,
      user.userId,
      user.sessionId
    )
    await senderClient.mutation(api.commands.enqueue, {
      targetSessionId: user.sessionId,
      command: "play",
      payload: '{"url":"first"}',
      targetReceiverId: "first-receiver",
    })
    await senderClient.mutation(api.commands.enqueue, {
      targetSessionId: secondSessionId,
      command: "play",
      payload: "{}",
      targetReceiverId: "second-receiver",
    })

    const receiverClient = asAuthenticatedUser(
      convex,
      user.userId,
      secondSessionId
    )
    await expect(
      receiverClient.mutation(api.commands.claimNext, {
        receiverId: "first-receiver",
      })
    ).resolves.toBeNull()
    const command = await receiverClient.mutation(api.commands.claimNext, {
      receiverId: "second-receiver",
    })
    expect(command?.command).toBe("play")
  })

  it("prevents another session from claiming a command", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "ack-owner")
    const secondSessionId = await convex.run(
      async (context) =>
        await context.db.insert("authSessions", {
          userId: user.userId,
          expirationTime: Date.now() + REMOTE_COMMAND_TTL_MS,
        })
    )
    const senderClient = asAuthenticatedUser(
      convex,
      user.userId,
      user.sessionId
    )
    const commandId = await senderClient.mutation(api.commands.enqueue, {
      targetSessionId: secondSessionId,
      command: "play",
      payload: "{}",
      targetReceiverId: "receiver",
    })

    expect(commandId).toBeTruthy()
    await expect(
      senderClient.mutation(api.commands.claimNext, { receiverId: "receiver" })
    ).resolves.toBeNull()
  })

  it("reports an applied command idempotently", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "ack-current")
    const authenticatedClient = asAuthenticatedUser(
      convex,
      user.userId,
      user.sessionId
    )
    const commandId = await authenticatedClient.mutation(api.commands.enqueue, {
      targetSessionId: user.sessionId,
      command: "play",
      payload: "{}",
      targetReceiverId: "receiver",
    })
    const claim = await authenticatedClient.mutation(api.commands.claimNext, {
      receiverId: "receiver",
    })
    expect(claim?.id).toBe(commandId)
    await expect(
      authenticatedClient.mutation(api.commands.reportResult, {
        id: commandId,
        receiverId: "receiver",
        claimToken: claim?.claimToken ?? "",
        result: "applied",
      })
    ).resolves.toEqual({ success: true })
    await expect(
      authenticatedClient.mutation(api.commands.reportResult, {
        id: commandId,
        receiverId: "receiver",
        claimToken: claim?.claimToken ?? "",
        result: "applied",
      })
    ).resolves.toEqual({ success: true })
    await expect(
      authenticatedClient.mutation(api.commands.claimNext, {
        receiverId: "receiver",
      })
    ).resolves.toBeNull()
  })

  it("claims the oldest targeted command within the bounded query", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "bounded-list")
    await convex.run(async (context) => {
      for (
        let commandIndex = REMOTE_COMMAND_QUERY_LIMIT;
        commandIndex >= 0;
        commandIndex -= 1
      ) {
        await context.db.insert("remoteCommands", {
          userId: user.userId,
          targetSessionId: user.sessionId,
          targetReceiverId: "receiver",
          command: "play",
          payload: String(commandIndex),
          createdAt: commandIndex,
          expiresAt: Date.now() + REMOTE_COMMAND_TTL_MS,
          status: "queued",
        })
      }
    })
    const receiverClient = asAuthenticatedUser(
      convex,
      user.userId,
      user.sessionId
    )

    const command = await receiverClient.mutation(api.commands.claimNext, {
      receiverId: "receiver",
    })
    expect(command?.createdAt).toBe(0)
  })

  it("rejects oversized payloads and unknown command names", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "validation")
    const authenticatedClient = asAuthenticatedUser(
      convex,
      user.userId,
      user.sessionId
    )

    await expect(
      authenticatedClient.mutation(api.commands.enqueue, {
        targetSessionId: user.sessionId,
        command: "play",
        payload: "x".repeat(REMOTE_COMMAND_MAX_PAYLOAD_BYTES + 1),
        targetReceiverId: "receiver",
      })
    ).rejects.toThrow("payload is too large")
    await expect(
      authenticatedClient.mutation(api.commands.enqueue, {
        targetSessionId: user.sessionId,
        command: "stop",
        payload: "{}",
        targetReceiverId: "receiver",
      })
    ).rejects.toThrow()
  })

  it("cleans expired commands in bounded batches", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "cleanup")
    await convex.run(async (context) => {
      for (
        let commandIndex = 0;
        commandIndex < REMOTE_COMMAND_CLEANUP_BATCH_SIZE + 1;
        commandIndex += 1
      ) {
        await context.db.insert("remoteCommands", {
          userId: user.userId,
          targetSessionId: user.sessionId,
          targetReceiverId: "receiver",
          command: "play",
          payload: String(commandIndex),
          createdAt: commandIndex,
          expiresAt: 999_999,
          status: "queued",
        })
      }
    })

    await expect(
      convex.mutation(internal.commands.cleanupExpired)
    ).resolves.toEqual({ deletedCount: REMOTE_COMMAND_CLEANUP_BATCH_SIZE })
    await expect(
      convex.run(
        async (context) => await context.db.query("remoteCommands").collect()
      )
    ).resolves.toHaveLength(1)
    await convex.finishAllScheduledFunctions(vi.runAllTimers)
    await expect(
      convex.run(
        async (context) => await context.db.query("remoteCommands").collect()
      )
    ).resolves.toHaveLength(0)
    vi.useRealTimers()
  })
})
