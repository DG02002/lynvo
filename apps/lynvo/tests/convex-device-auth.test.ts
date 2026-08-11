// @vitest-environment edge-runtime

import { api, internal } from "../convex/_generated/api"
import {
  DEVICE_CODE_CLEANUP_BATCH_SIZE,
  DEVICE_CODE_TTL_MS,
} from "../convex/constants"
import { signAuthPreflightToken } from "../app/lib/auth-gateway"
import {
  asAuthenticatedUser,
  createConvexTest,
  insertTestUser,
} from "./convex-test-harness"

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

describe("device authorization", () => {
  it("generates fixed-width codes without Math.random", async () => {
    const gatewaySecret = "test-cryptographic-device-code-secret"
    vi.stubEnv("AUTH_GATEWAY_SECRET", gatewaySecret)
    const convex = createConvexTest()
    const preflightToken = await signAuthPreflightToken(
      { purpose: "deviceCode", exp: Date.now() + DEVICE_CODE_TTL_MS },
      gatewaySecret
    )
    const randomSpy = vi.spyOn(Math, "random").mockImplementation(() => {
      throw new Error("Math.random must not generate authentication codes")
    })

    const generated = await convex.mutation(api.deviceAuth.generateCode, {
      deviceName: "Personal phone",
      preflightToken,
    })
    expect(generated.code).toMatch(/^[A-Z]{4}-[A-Z]{4}$/)
    expect(generated.deviceName).toBe("Personal phone")
    randomSpy.mockRestore()
    vi.unstubAllEnvs()
  })

  it("requires a valid gateway preflight and polling secret", async () => {
    const gatewaySecret = "test-device-code-gateway-secret"
    vi.stubEnv("AUTH_GATEWAY_SECRET", gatewaySecret)
    const convex = createConvexTest()

    await expect(
      convex.mutation(api.deviceAuth.generateCode, {
        deviceName: "Test TV",
        preflightToken: "invalid",
      })
    ).rejects.toThrow("Invalid auth preflight token")

    const preflightToken = await signAuthPreflightToken(
      { purpose: "deviceCode", exp: Date.now() + DEVICE_CODE_TTL_MS },
      gatewaySecret
    )
    const generated = await convex.mutation(api.deviceAuth.generateCode, {
      deviceName: "Test TV",
      preflightToken,
    })

    await expect(
      convex.query(api.deviceAuth.getStatus, {
        code: generated.code,
        pollSecret: "wrong-secret",
      })
    ).resolves.toEqual({ status: "invalid" })
    await expect(
      convex.query(api.deviceAuth.getStatus, {
        code: generated.code,
        pollSecret: generated.pollSecret,
      })
    ).resolves.toMatchObject({
      status: "pending",
      expiresAt: generated.expiresAt,
    })
    vi.unstubAllEnvs()
  })

  it("requires authentication to approve a code", async () => {
    const convex = createConvexTest()
    await convex.run(async (context) => {
      await context.db.insert("deviceCodes", {
        code: "ABCD-EFGH",
        pollSecretDigest: await digestPollSecret("poll-secret"),
        status: "pending",
        deviceName: "Test TV",
        expiresAt: Date.now() + DEVICE_CODE_TTL_MS,
        createdAt: Date.now(),
      })
    })

    await expect(
      convex.mutation(api.deviceAuth.authorizeCode, { code: "ABCD-EFGH" })
    ).rejects.toThrow("UNAUTHORIZED")
  })

  it("claims and finalizes an approved code only after session creation", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "device-owner")
    const pollSecret = "poll-secret"
    const expiresAt = 1_000_000
    await convex.run(async (context) => {
      await context.db.insert("deviceCodes", {
        code: "BCDE-FGHI",
        pollSecretDigest: await digestPollSecret(pollSecret),
        status: "pending",
        deviceName: "Test TV",
        expiresAt,
        createdAt: 1,
      })
    })
    const authenticatedClient = asAuthenticatedUser(
      convex,
      user.userId,
      user.sessionId
    )
    vi.useFakeTimers()
    vi.setSystemTime(expiresAt - 1)
    await authenticatedClient.mutation(api.deviceAuth.authorizeCode, {
      code: "BCDE-FGHI",
    })

    await expect(
      convex.mutation(internal.deviceAuth.claimAuthorizedCode, {
        code: "BCDE-FGHI",
        pollSecret,
        now: expiresAt - 1,
        attemptId: "exchange-one",
      })
    ).resolves.toMatchObject({ userId: user.userId })
    await expect(
      convex.mutation(internal.deviceAuth.claimAuthorizedCode, {
        code: "BCDE-FGHI",
        pollSecret,
        now: expiresAt - 1,
        attemptId: "exchange-two",
      })
    ).rejects.toThrow("Approve this code")
    await authenticatedClient.mutation(api.deviceAuth.finalizeExchange, {
      code: "BCDE-FGHI",
      pollSecret,
      attemptId: "exchange-one",
      sessionId: user.sessionId,
    })
    await expect(
      authenticatedClient.mutation(api.deviceAuth.finalizeExchange, {
        code: "BCDE-FGHI",
        pollSecret,
        attemptId: "exchange-one",
        sessionId: user.sessionId,
      })
    ).resolves.toBeNull()
    await authenticatedClient.mutation(api.deviceAuth.releaseExchange, {
      code: "BCDE-FGHI",
      attemptId: "exchange-one",
      sessionId: user.sessionId,
    })
    await expect(
      convex.mutation(internal.deviceAuth.claimAuthorizedCode, {
        code: "BCDE-FGHI",
        pollSecret,
        now: expiresAt - 1,
        attemptId: "exchange-retry",
      })
    ).resolves.toMatchObject({ userId: user.userId })

    await convex.run(async (context) => {
      await context.db.insert("deviceCodes", {
        code: "CDEF-GHIJ",
        pollSecretDigest: await digestPollSecret(pollSecret),
        status: "authorized",
        userId: user.userId,
        deviceName: "Expired TV",
        expiresAt,
        createdAt: 1,
      })
    })
    await expect(
      convex.mutation(internal.deviceAuth.claimAuthorizedCode, {
        code: "CDEF-GHIJ",
        pollSecret,
        now: expiresAt,
        attemptId: "expired-exchange",
      })
    ).rejects.toThrow("Approve this code")
    vi.useRealTimers()
  })

  it("cleans expired codes in bounded batches", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000_000)
    const convex = createConvexTest()
    await convex.run(async (context) => {
      for (
        let codeIndex = 0;
        codeIndex < DEVICE_CODE_CLEANUP_BATCH_SIZE + 1;
        codeIndex += 1
      ) {
        await context.db.insert("deviceCodes", {
          code: `TEST-${String.fromCharCode(65 + Math.floor(codeIndex / 26))}${String.fromCharCode(65 + (codeIndex % 26))}AA`,
          pollSecretDigest: await digestPollSecret(String(codeIndex)),
          status: "pending",
          deviceName: "Expired TV",
          expiresAt: 999_999,
          createdAt: codeIndex,
        })
      }
    })

    await expect(
      convex.mutation(internal.deviceAuth.cleanupExpiredCodes)
    ).resolves.toEqual({ deleted: DEVICE_CODE_CLEANUP_BATCH_SIZE })
    await expect(
      convex.run(
        async (context) => await context.db.query("deviceCodes").collect()
      )
    ).resolves.toHaveLength(1)
    await convex.finishAllScheduledFunctions(vi.runAllTimers)
    await expect(
      convex.run(
        async (context) => await context.db.query("deviceCodes").collect()
      )
    ).resolves.toHaveLength(0)
    vi.useRealTimers()
  })
})
