import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"
import {
  REMOTE_COMMAND_CLEANUP_BATCH_SIZE,
  REMOTE_COMMAND_CLAIM_LEASE_MS,
  REMOTE_COMMAND_MAX_PAYLOAD_BYTES,
  REMOTE_COMMAND_TTL_MS,
} from "../../workers/constants"
import {
  acknowledgeRemoteCommandNotification,
  claimNextRemoteCommand,
  cleanupExpiredRemoteCommands,
  enqueueRemoteCommand,
  listPendingRemoteCommandNotifications,
  reportRemoteCommandResult,
} from "../../workers/d1/remote-commands"
import { createSession } from "../../workers/d1/sessions"
import { insertGoogleUser } from "../../workers/d1/users"

const NOW = 1_750_000_000_000

const createSessionForUser = async () => {
  const user = await insertGoogleUser(env.DB, {
    googleSubject: `subject-${crypto.randomUUID()}`,
    email: "remote-test@example.com",
    now: NOW,
  })
  const session = await createSession(env.DB, { userId: user.id, now: NOW })
  return { user, session }
}

describe("d1 remote commands", () => {
  it("refuses to target another user's session", async () => {
    const sender = await createSessionForUser()
    const target = await createSessionForUser()
    await expect(
      enqueueRemoteCommand(env.DB, sender.user.id, {
        targetSessionId: target.session.id,
        command: "play",
        payload: "{}",
        targetReceiverId: "receiver",
        now: NOW,
      })
    ).rejects.toThrow("Remote session not found")
  })

  it("claims commands only for the targeted session and receiver", async () => {
    const owner = await createSessionForUser()
    const secondSession = await createSession(env.DB, {
      userId: owner.user.id,
      now: NOW,
    })
    await enqueueRemoteCommand(env.DB, owner.user.id, {
      targetSessionId: owner.session.id,
      command: "play",
      payload: '{"url":"first"}',
      targetReceiverId: "first-receiver",
      now: NOW,
    })
    await enqueueRemoteCommand(env.DB, owner.user.id, {
      targetSessionId: secondSession.id,
      command: "play",
      payload: "{}",
      targetReceiverId: "second-receiver",
      now: NOW + 1,
    })
    await expect(
      claimNextRemoteCommand(env.DB, owner.user.id, secondSession.id, {
        receiverId: "first-receiver",
        now: NOW + 2,
      })
    ).resolves.toBeNull()
    const claim = await claimNextRemoteCommand(
      env.DB,
      owner.user.id,
      secondSession.id,
      { receiverId: "second-receiver", now: NOW + 2 }
    )
    expect(claim?.command).toBe("play")
    expect(claim?.claimToken).toBeTruthy()
  })

  it("reports an applied command idempotently and refuses stale claims", async () => {
    const owner = await createSessionForUser()
    const enqueued = await enqueueRemoteCommand(env.DB, owner.user.id, {
      targetSessionId: owner.session.id,
      command: "play",
      payload: "{}",
      targetReceiverId: "receiver",
      now: NOW,
    })
    const claim = await claimNextRemoteCommand(
      env.DB,
      owner.user.id,
      owner.session.id,
      { receiverId: "receiver", now: NOW + 1 }
    )
    expect(claim?.id).toBe(enqueued.id)
    const firstReport = await reportRemoteCommandResult(
      env.DB,
      owner.user.id,
      owner.session.id,
      {
        id: enqueued.id,
        receiverId: "receiver",
        claimToken: claim?.claimToken ?? "",
        result: "applied",
        message: "ok",
        now: NOW + 2,
      }
    )
    expect(firstReport.success).toBe(true)
    const replayedReport = await reportRemoteCommandResult(
      env.DB,
      owner.user.id,
      owner.session.id,
      {
        id: enqueued.id,
        receiverId: "receiver",
        claimToken: claim?.claimToken ?? "",
        result: "applied",
        message: "ok",
        now: NOW + 3,
      }
    )
    expect(replayedReport.success).toBe(true)
    await expect(
      reportRemoteCommandResult(env.DB, owner.user.id, owner.session.id, {
        id: enqueued.id,
        receiverId: "receiver",
        claimToken: "wrong-token",
        result: "failed",
        now: NOW + 4,
      })
    ).rejects.toThrow("Remote command claim is no longer active")
    await expect(
      claimNextRemoteCommand(env.DB, owner.user.id, owner.session.id, {
        receiverId: "receiver",
        now: NOW + 5,
      })
    ).resolves.toBeNull()
  })

  it("reclaims a claimed command after the lease expires", async () => {
    const owner = await createSessionForUser()
    await enqueueRemoteCommand(env.DB, owner.user.id, {
      targetSessionId: owner.session.id,
      command: "play",
      payload: "{}",
      targetReceiverId: "receiver",
      now: NOW,
    })
    const firstClaim = await claimNextRemoteCommand(
      env.DB,
      owner.user.id,
      owner.session.id,
      { receiverId: "receiver", now: NOW + 1 }
    )
    expect(firstClaim).not.toBeNull()
    await expect(
      claimNextRemoteCommand(env.DB, owner.user.id, owner.session.id, {
        receiverId: "receiver",
        now: NOW + 2,
      })
    ).resolves.toBeNull()
    const reclaimed = await claimNextRemoteCommand(
      env.DB,
      owner.user.id,
      owner.session.id,
      { receiverId: "receiver", now: NOW + 2 + REMOTE_COMMAND_CLAIM_LEASE_MS }
    )
    expect(reclaimed?.id).toBe(firstClaim?.id)
    expect(reclaimed?.claimToken).not.toBe(firstClaim?.claimToken)
  })

  it("claims the oldest targeted command within the bounded query", async () => {
    const owner = await createSessionForUser()
    for (let index = 100; index >= 0; index -= 1) {
      await env.DB.prepare(
        `INSERT INTO remote_commands (id, user_id, target_session_id, target_receiver_id, command, payload, created_at, expires_at, status, available_at, notification_pending)
         VALUES (?1, ?2, ?3, 'receiver', 'play', ?4, ?5, ?6, 'queued', ?5, 0)`
      )
        .bind(
          `bounded-${index}`,
          owner.user.id,
          owner.session.id,
          String(index),
          index,
          NOW + REMOTE_COMMAND_TTL_MS
        )
        .run()
    }
    const claim = await claimNextRemoteCommand(
      env.DB,
      owner.user.id,
      owner.session.id,
      { receiverId: "receiver", now: NOW + 1 }
    )
    expect(claim?.createdAt).toBe(0)
    expect(claim?.payload).toBe("0")
  })

  it("claims eligible work behind more than one hundred terminal rows", async () => {
    const owner = await createSessionForUser()
    for (let index = 0; index < 101; index += 1) {
      await env.DB.prepare(
        `INSERT INTO remote_commands (id, user_id, target_session_id, target_receiver_id, command, payload, created_at, expires_at, status)
         VALUES (?1, ?2, ?3, 'receiver', 'play', '{}', ?4, ?5, 'applied')`
      )
        .bind(`terminal-${index}`, owner.user.id, owner.session.id, index, NOW + REMOTE_COMMAND_TTL_MS)
        .run()
    }
    const enqueued = await enqueueRemoteCommand(env.DB, owner.user.id, {
      targetSessionId: owner.session.id,
      command: "play",
      payload: "deliverable",
      targetReceiverId: "receiver",
      now: NOW + 1_000,
    })
    const claim = await claimNextRemoteCommand(
      env.DB,
      owner.user.id,
      owner.session.id,
      { receiverId: "receiver", now: NOW + 1_001 }
    )
    expect(claim?.id).toBe(enqueued.id)
    expect(claim?.payload).toBe("deliverable")
  })

  it("rejects oversized payloads and unknown command names", async () => {
    const owner = await createSessionForUser()
    await expect(
      enqueueRemoteCommand(env.DB, owner.user.id, {
        targetSessionId: owner.session.id,
        command: "play",
        payload: "x".repeat(REMOTE_COMMAND_MAX_PAYLOAD_BYTES + 1),
        targetReceiverId: "receiver",
        now: NOW,
      })
    ).rejects.toThrow("payload is too large")
    await expect(
      enqueueRemoteCommand(env.DB, owner.user.id, {
        targetSessionId: owner.session.id,
        command: "stop" as "play",
        payload: "{}",
        targetReceiverId: "receiver",
        now: NOW,
      })
    ).rejects.toThrow()
  })

  it("cleans expired commands in bounded batches", async () => {
    const owner = await createSessionForUser()
    for (let index = 0; index < REMOTE_COMMAND_CLEANUP_BATCH_SIZE + 1; index += 1) {
      await env.DB.prepare(
        `INSERT INTO remote_commands (id, user_id, target_session_id, target_receiver_id, command, payload, created_at, expires_at, status)
         VALUES (?1, ?2, ?3, 'receiver', 'play', ?4, ?5, 999999, 'queued')`
      )
        .bind(`expired-${index}`, owner.user.id, owner.session.id, String(index), index)
        .run()
    }
    const outcome = await cleanupExpiredRemoteCommands(env.DB, 1_000_000)
    expect(outcome.deletedCount).toBe(REMOTE_COMMAND_CLEANUP_BATCH_SIZE)
    const remaining = await env.DB.prepare(
      "SELECT COUNT(*) AS count FROM remote_commands WHERE user_id = ?1"
    )
      .bind(owner.user.id)
      .first<{ count: number }>()
    expect(remaining?.count).toBe(1)
  })

  it("lists pending notifications once and acknowledges them", async () => {
    const owner = await createSessionForUser()
    const enqueued = await enqueueRemoteCommand(env.DB, owner.user.id, {
      targetSessionId: owner.session.id,
      command: "play",
      payload: "{}",
      targetReceiverId: "notify-receiver",
      now: NOW,
    })
    const pending = await listPendingRemoteCommandNotifications(env.DB)
    expect(
      pending.some((notification) => notification.commandId === enqueued.id)
    ).toBe(true)
    expect(pending[0]?.userId).toBeTruthy()
    await acknowledgeRemoteCommandNotification(env.DB, enqueued.id)
    const afterAcknowledge = await listPendingRemoteCommandNotifications(env.DB)
    expect(
      afterAcknowledge.some((notification) => notification.commandId === enqueued.id)
    ).toBe(false)
  })
})
