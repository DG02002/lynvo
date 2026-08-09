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
  it("rejects anonymous enqueue, list, and acknowledgement calls", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "anonymous-target")
    const commandId = await convex.run(async (context) => {
      const now = Date.now()
      return await context.db.insert("remoteCommands", {
        userId: user.userId,
        targetSessionId: user.sessionId,
        command: "play",
        payload: "{}",
        createdAt: now,
        expiresAt: now + REMOTE_COMMAND_TTL_MS,
      })
    })

    await expect(
      convex.mutation(api.commands.enqueue, {
        targetSessionId: user.sessionId,
        command: "play",
        payload: "{}",
      })
    ).rejects.toThrow("UNAUTHORIZED")
    await expect(
      convex.query(api.commands.listForCurrentSession)
    ).rejects.toThrow("UNAUTHORIZED")
    await expect(
      convex.mutation(api.commands.acknowledge, { id: commandId })
    ).rejects.toThrow("UNAUTHORIZED")
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
      })
    ).rejects.toThrow("Remote session not found")
  })

  it("lists commands only for the current authenticated session", async () => {
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
    })
    await senderClient.mutation(api.commands.enqueue, {
      targetSessionId: secondSessionId,
      command: "play",
      payload: "{}",
    })

    const receiverClient = asAuthenticatedUser(
      convex,
      user.userId,
      secondSessionId
    )
    const commands = await receiverClient.query(
      api.commands.listForCurrentSession
    )

    expect(commands).toHaveLength(1)
    expect(commands[0]?.command).toBe("play")
  })

  it("prevents acknowledgement from another session", async () => {
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
    })

    await expect(
      senderClient.mutation(api.commands.acknowledge, { id: commandId })
    ).rejects.toThrow("Remote command not found")
  })

  it("acknowledges a command owned by the current session", async () => {
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
    })

    await expect(
      authenticatedClient.mutation(api.commands.acknowledge, { id: commandId })
    ).resolves.toEqual({ success: true })
    await expect(
      authenticatedClient.query(api.commands.listForCurrentSession)
    ).resolves.toEqual([])
  })

  it("caps pending commands and orders them oldest first", async () => {
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
          command: "play",
          payload: String(commandIndex),
          createdAt: commandIndex,
          expiresAt: Date.now() + REMOTE_COMMAND_TTL_MS,
        })
      }
    })
    const receiverClient = asAuthenticatedUser(
      convex,
      user.userId,
      user.sessionId
    )

    const commands = await receiverClient.query(
      api.commands.listForCurrentSession
    )

    expect(commands).toHaveLength(REMOTE_COMMAND_QUERY_LIMIT)
    expect(commands[0]?.createdAt).toBe(0)
    expect(commands.at(-1)?.createdAt).toBe(REMOTE_COMMAND_QUERY_LIMIT - 1)
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
      })
    ).rejects.toThrow("payload is too large")
    await expect(
      authenticatedClient.mutation(api.commands.enqueue, {
        targetSessionId: user.sessionId,
        command: "stop",
        payload: "{}",
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
          command: "play",
          payload: String(commandIndex),
          createdAt: commandIndex,
          expiresAt: 999_999,
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
