import { describe, expect, it, vi } from "vitest"
import {
  createAuthenticationIntake,
  type AuthenticationIntakeDependencies,
} from "../workers/authentication-intake"

const createRequest = (path: string, body: unknown, origin?: string) =>
  new Request(`https://lynvo.dg02002.workers.dev${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(origin ? { Origin: origin } : {}),
    },
    body: JSON.stringify(body),
  })

const createDependencies = (
  overrides: Partial<AuthenticationIntakeDependencies> = {}
): AuthenticationIntakeDependencies => ({
  gatewaySecret: "test-authentication-intake-secret",
  now: () => 1_000,
  clientIp: () => "203.0.113.1",
  rateLimit: vi.fn().mockResolvedValue("allowed"),
  verifyTurnstile: vi.fn().mockResolvedValue(true),
  generateDeviceCode: vi.fn().mockResolvedValue({
    deviceCode: "device-code",
    userCode: "USER-CODE",
  }),
  ...overrides,
})

describe("authentication intake", () => {
  it("owns preflight validation, abuse controls, and token creation ordering", async () => {
    const operationOrder: string[] = []
    const dependencies = createDependencies({
      rateLimit: vi.fn().mockImplementation(async () => {
        operationOrder.push("rate-limit")
        return "allowed"
      }),
      verifyTurnstile: vi.fn().mockImplementation(async () => {
        operationOrder.push("turnstile")
        return true
      }),
    })
    const intake = createAuthenticationIntake(dependencies)

    const outcome = await intake.preflight(
      createRequest("/api/auth/preflight", {
        flow: "signIn",
        username: "Darshan",
        turnstileToken: "verified-token",
      })
    )

    expect(outcome.kind).toBe("success")
    expect(operationOrder).toEqual(["rate-limit", "turnstile"])
    expect(dependencies.rateLimit).toHaveBeenCalledWith({
      key: "auth:signin:203.0.113.1:darshan",
      limit: 10,
      windowSeconds: 600,
    })
    expect(outcome.body).toHaveProperty("preflightToken")
  })

  it("stops before Turnstile when the preflight rate limit is exhausted", async () => {
    const verifyTurnstile = vi.fn()
    const intake = createAuthenticationIntake(
      createDependencies({
        rateLimit: vi.fn().mockResolvedValue("limited"),
        verifyTurnstile,
      })
    )

    const outcome = await intake.preflight(
      createRequest("/api/auth/preflight", {
        flow: "signUp",
        username: "darshan",
        turnstileToken: "token",
      })
    )

    expect(outcome).toMatchObject({
      kind: "failure",
      status: 429,
      error: { code: "rate_limited" },
    })
    expect(verifyTurnstile).not.toHaveBeenCalled()
  })

  it("rejects cross-origin device-code requests before dependencies run", async () => {
    const dependencies = createDependencies()
    const intake = createAuthenticationIntake(dependencies)

    const outcome = await intake.createDeviceCode(
      createRequest(
        "/api/auth/device/code",
        { deviceName: "Living room TV" },
        "https://attacker.example"
      )
    )

    expect(outcome).toMatchObject({
      kind: "failure",
      status: 403,
      error: { code: "forbidden" },
    })
    expect(dependencies.rateLimit).not.toHaveBeenCalled()
    expect(dependencies.generateDeviceCode).not.toHaveBeenCalled()
  })

  it("classifies device-code adapter failures as retryable outcomes", async () => {
    const intake = createAuthenticationIntake(
      createDependencies({
        generateDeviceCode: vi.fn().mockRejectedValue(new Error("offline")),
      })
    )

    const outcome = await intake.createDeviceCode(
      createRequest("/api/auth/device/code", { deviceName: "Living room TV" })
    )

    expect(outcome).toMatchObject({
      kind: "failure",
      status: 503,
      error: { code: "service_unavailable", retryable: true },
      observability: { error: { type: "Error", message: "offline" } },
    })
  })
})
