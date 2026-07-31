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

    const generated = await convex.mutation(api.tv.generateCode, {
      deviceName: "Test TV",
      preflightToken,
    })
    expect(generated.code).toMatch(/^\d{8}$/)
    randomSpy.mockRestore()
    vi.unstubAllEnvs()
  })

  it("requires a valid gateway preflight and polling secret", async () => {
    const gatewaySecret = "test-device-code-gateway-secret"
    vi.stubEnv("AUTH_GATEWAY_SECRET", gatewaySecret)
    const convex = createConvexTest()

    await expect(
      convex.mutation(api.tv.generateCode, {
        deviceName: "Test TV",
        preflightToken: "invalid",
      })
    ).rejects.toThrow("Invalid auth preflight token")

    const preflightToken = await signAuthPreflightToken(
      { purpose: "deviceCode", exp: Date.now() + DEVICE_CODE_TTL_MS },
      gatewaySecret
    )
    const generated = await convex.mutation(api.tv.generateCode, {
      deviceName: "Test TV",
      preflightToken,
    })

    await expect(
      convex.query(api.tv.getStatus, {
        code: generated.code,
        pollSecret: "wrong-secret",
      })
    ).resolves.toEqual({ status: "invalid" })
    await expect(
      convex.query(api.tv.getStatus, {
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
        code: "12345678",
        pollSecretDigest: await digestPollSecret("poll-secret"),
        status: "pending",
        deviceName: "Test TV",
        expiresAt: Date.now() + DEVICE_CODE_TTL_MS,
        createdAt: Date.now(),
      })
    })

    await expect(
      convex.mutation(api.tv.authorizeCode, { code: "12345678" })
    ).rejects.toThrow("UNAUTHORIZED")
  })

  it("consumes an approved code atomically once and enforces expiry", async () => {
    const convex = createConvexTest()
    const user = await insertTestUser(convex, "device-owner")
    const pollSecret = "poll-secret"
    const expiresAt = 1_000_000
    await convex.run(async (context) => {
      await context.db.insert("deviceCodes", {
        code: "23456789",
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
    await authenticatedClient.mutation(api.tv.authorizeCode, {
      code: "23456789",
    })

    await expect(
      convex.mutation(internal.tv.consumeAuthorizedCode, {
        code: "23456789",
        pollSecret,
        now: expiresAt - 1,
      })
    ).resolves.toMatchObject({ userId: user.userId })
    await expect(
      convex.mutation(internal.tv.consumeAuthorizedCode, {
        code: "23456789",
        pollSecret,
        now: expiresAt - 1,
      })
    ).rejects.toThrow("Approve this code")

    await convex.run(async (context) => {
      await context.db.insert("deviceCodes", {
        code: "34567890",
        pollSecretDigest: await digestPollSecret(pollSecret),
        status: "authorized",
        userId: user.userId,
        deviceName: "Expired TV",
        expiresAt,
        createdAt: 1,
      })
    })
    await expect(
      convex.mutation(internal.tv.consumeAuthorizedCode, {
        code: "34567890",
        pollSecret,
        now: expiresAt,
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
          code: String(codeIndex).padStart(8, "0"),
          pollSecretDigest: await digestPollSecret(String(codeIndex)),
          status: "pending",
          deviceName: "Expired TV",
          expiresAt: 999_999,
          createdAt: codeIndex,
        })
      }
    })

    await expect(
      convex.mutation(internal.tv.cleanupExpiredCodes)
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
