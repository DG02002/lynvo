import { beforeEach, describe, expect, it } from "vitest"
import {
  readLinksCache,
  readLocalRecents,
} from "~/features/links/use-recent-links/cache"
import { authSignInResponseSchema } from "~/lib/auth-http-schema"
import {
  authPreflightRequestSchema,
  authSignInRequestSchema,
  turnstileVerificationResponseSchema,
} from "~/lib/auth-gateway-schemas"
import { getSafeRedirectPath } from "~/components/auth/auth-form-actions"
import { remoteSessionsResponseSchema } from "~/components/remote-play/schemas"
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

  it("drops malformed saved links while preserving valid cache entries", () => {
    localStorage.setItem(
      "sl2jp:recents:sync:v1:user-1",
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
      results: [{ id: "link-1", url: "https://example.com" }],
    })
  })

  it("drops malformed local recent entries", () => {
    localStorage.setItem(
      "sl2jp:recents:v1",
      JSON.stringify([
        { url: "https://example.com", timestamp: 10 },
        { url: 42, timestamp: "invalid" },
      ])
    )

    expect(readLocalRecents()).toEqual([
      {
        url: "https://example.com",
        timestamp: 10,
        extractedLinks: undefined,
      },
    ])
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

  it("requires complete token pairs in auth responses", () => {
    expect(
      authSignInResponseSchema.safeParse({
        tokens: { token: "access", refreshToken: "refresh" },
      }).success
    ).toBe(true)
    expect(
      authSignInResponseSchema.safeParse({
        tokens: { token: "access" },
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
  })

  it("validates remote session and Turnstile responses", () => {
    expect(
      remoteSessionsResponseSchema.safeParse({
        sessions: [
          {
            id: "session-1",
            device_name: "TV",
            user_agent: "Browser",
            last_active_at: 10,
            location: "Home",
          },
        ],
      }).success
    ).toBe(true)
    expect(
      remoteSessionsResponseSchema.safeParse({
        sessions: [{ id: "session-1" }],
      }).success
    ).toBe(false)
    expect(
      turnstileVerificationResponseSchema.safeParse({ success: true }).success
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
