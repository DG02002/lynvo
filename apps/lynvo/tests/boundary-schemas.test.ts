import { beforeEach, describe, expect, it } from "vitest"
import { readLinksCache } from "~/features/links/use-links/cache"
import { authSignInResponseSchema } from "~/lib/auth-http-schema"
import {
  authPreflightRequestSchema,
  authSignInRequestSchema,
  turnstileVerificationResponseSchema,
} from "~/lib/auth-gateway-schemas"
import { getSafeRedirectPath } from "~/components/auth/auth-form-actions"
import {
  remotePollResponseSchema,
  remoteRealtimeEventSchema,
} from "~/context/remote-control/schemas"

const createMemoryStorage = () => {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
    clear: () => values.clear(),
  }
}

describe("browser storage boundaries", () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, "localStorage", {
      value: createMemoryStorage(),
      configurable: true,
    })
  })

  it("drops saved links that do not use the current cache shape", () => {
    localStorage.setItem(
      "lynvo:links:sync:v1:user-1",
      JSON.stringify({
        version: 2,
        etag: "etag",
        results: [
          {
            id: "link-1",
            url: "https://example.com",
            created_at: 10,
          },
          { id: 42, url: null },
        ],
      })
    )

    expect(readLinksCache("user-1")).toMatchObject({
      version: 2,
      etag: "etag",
      results: [],
    })
  })

})

describe("HTTP and realtime boundaries", () => {
  it("validates Worker authentication requests", () => {
    expect(
      authPreflightRequestSchema.safeParse({
        flow: "signIn",
        username: "darshan",
        turnstileToken: "token",
      }).success
    ).toBe(true)
    expect(
      authPreflightRequestSchema.safeParse({
        flow: "resetPassword",
        username: "darshan",
        turnstileToken: "token",
      }).success
    ).toBe(false)
    expect(
      authSignInRequestSchema.safeParse({
        provider: "credentials",
        params: { flow: "signIn", username: "darshan" },
      }).success
    ).toBe(true)
    expect(
      authSignInRequestSchema.safeParse({
        provider: "untrusted-provider",
        params: {},
      }).success
    ).toBe(false)
  })

  it("enforces the Turnstile token protocol boundary", () => {
    const request = {
      flow: "signIn",
      username: "darshan",
      turnstileToken: "t".repeat(2_048),
    }

    expect(authPreflightRequestSchema.safeParse(request).success).toBe(true)
    expect(
      authPreflightRequestSchema.safeParse({
        ...request,
        turnstileToken: `${request.turnstileToken}t`,
      }).success
    ).toBe(false)
    expect(
      turnstileVerificationResponseSchema.safeParse({
        success: true,
        hostname: "lynvo.dg02002.workers.dev",
        action: "lynvo-sign-in",
      }).success
    ).toBe(true)
    expect(
      turnstileVerificationResponseSchema.safeParse({
        success: true,
        hostname: "lynvo.dg02002.workers.dev",
      }).success
    ).toBe(false)
  })

  it("rejects tokens in browser auth responses", () => {
    expect(
      authSignInResponseSchema.safeParse({
        signingIn: true,
      }).success
    ).toBe(true)
    expect(
      authSignInResponseSchema.safeParse({
        signingIn: true,
        tokens: { token: "access", refreshToken: "refresh" },
      }).success
    ).toBe(false)
  })

  it("validates remote poll devices", () => {
    expect(
      remotePollResponseSchema.safeParse({
        controllingDevices: [{ id: "session-1", name: "Living room" }],
      }).success
    ).toBe(true)
    expect(
      remotePollResponseSchema.safeParse({
        controllingDevices: [{ id: "session-1" }],
      }).success
    ).toBe(false)
    expect(
      remotePollResponseSchema.safeParse({
        commands: [
          {
            command: "play",
            payload: "{}",
            createdAt: 10,
          },
        ],
      }).success
    ).toBe(false)
  })

  it("validates Turnstile responses", () => {
    expect(
      turnstileVerificationResponseSchema.safeParse({
        success: true,
        hostname: "lynvo.dg02002.workers.dev",
        action: "lynvo-sign-in",
      }).success
    ).toBe(true)
    expect(
      turnstileVerificationResponseSchema.safeParse({ success: "yes" }).success
    ).toBe(false)
  })

  it("uses a discriminated union for remote events", () => {
    expect(
      remoteRealtimeEventSchema.safeParse({
        kind: "command",
        id: "command-1",
        command: "play",
        payload: "{}",
        createdAt: 10,
        targetSessionId: "session-1",
      }).success
    ).toBe(true)
    expect(
      remoteRealtimeEventSchema.safeParse({
        kind: "command",
        command: "play",
      }).success
    ).toBe(false)
  })
})

describe("safe authentication redirects", () => {
  const origin = "https://lynvo.example"

  it.each([
    ["/save", "/save"],
    ["/settings?tab=security#sessions", "/settings?tab=security#sessions"],
    [null, "/save"],
    ["https://evil.example/phishing", "/save"],
    ["//evil.example/phishing", "/save"],
    ["javascript:alert(1)", "/save"],
  ])("maps %s to %s", (redirect, expected) => {
    expect(getSafeRedirectPath(redirect, origin)).toBe(expected)
  })
})
