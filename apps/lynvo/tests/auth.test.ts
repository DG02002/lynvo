import { describe, expect, it } from "vitest"
import { Effect, Layer } from "effect"
import {
  decryptAuthTransaction,
  encryptAuthTransaction,
  getCookieValue,
  normalizeReturnTo,
} from "../app/lib/auth-cookie"
import {
  AUTH_JWT_COOKIE_NAME,
  WORKER_SESSION_COOKIE_NAME,
} from "../app/lib/constants"
import {
  normalizeUsername,
  validatePassword,
  validateUsername,
} from "../app/lib/auth-policy"
import { AuthSessionService } from "../app/lib/effect/services/AuthSessionService"
import { ConvexService } from "../app/lib/effect/services/ConvexService"
import { CloudflareEnv } from "../app/lib/effect/services/CloudflareEnv"

const runSession = (
  request: Request,
  convexLayer: Layer.Layer<ConvexService>
) =>
  Effect.runPromise(
    AuthSessionService.use((service) => service.getSession(request)).pipe(
      Effect.provide(AuthSessionService.layer),
      Effect.provide(convexLayer),
      Effect.provide(
        Layer.succeed(CloudflareEnv, {
          WORKER_AUTH_SESSION: {
            getByName: () => ({
              fetch: async () =>
                Response.json({
                  accessToken: "opaque-session-access-token",
                  refreshToken: "server-only-refresh-token",
                  createdAt: 1,
                  expiresAt: Date.now() + 60_000,
                }),
            }),
          },
        } as Env)
      )
    )
  )

describe("auth policy", () => {
  it("normalizes and validates usernames", () => {
    expect(normalizeUsername(" Darshan_1 ")).toBe("darshan_1")
    expect(validateUsername("abcde")).toBeTruthy()
    expect(validateUsername("darshan_1")).toBeNull()
    expect(validateUsername("settings")).toBe("This username is reserved.")
    expect(validateUsername("bad.name")).toBeTruthy()
  })

  it("validates the configured password policy", () => {
    expect(validatePassword("Password123!", "darshan")).toBeTruthy()
    expect(validatePassword("Darshan123!xxx", "darshan")).toBeTruthy()
    expect(validatePassword("StrongPassphrase!!!", "darshan")).toBeNull()
    expect(validatePassword("strongpassphrase123!", "darshan")).toBeNull()
    expect(validatePassword("StrongpasswordLong", "darshan")).toBeNull()
  })
})

describe("auth transaction helpers", () => {
  it("encrypts and authenticates the PKCE transaction", async () => {
    const transaction = {
      codeVerifier: "verifier",
      state: "state",
      returnTo: "/settings?tab=plugin-servers",
    }
    const encrypted = await encryptAuthTransaction(
      transaction,
      "a-cookie-password-that-is-longer-than-32-characters"
    )
    expect(encrypted).not.toContain("verifier")
    await expect(
      decryptAuthTransaction(
        encrypted,
        "a-cookie-password-that-is-longer-than-32-characters"
      )
    ).resolves.toEqual(transaction)
  })

  it("allows only application-relative return paths", () => {
    expect(normalizeReturnTo("/settings")).toBe("/settings")
    expect(normalizeReturnTo("https://attacker.test")).toBe("/")
    expect(normalizeReturnTo("//attacker.test")).toBe("/")
  })

  it("parses exact cookie names", () => {
    const request = new Request("https://lynvo.test", {
      headers: {
        Cookie: `other=1; ${AUTH_JWT_COOKIE_NAME}=access%20token`,
      },
    })
    expect(getCookieValue(request, AUTH_JWT_COOKIE_NAME)).toBe("access token")
  })
})

describe("AuthSessionService", () => {
  it("returns an anonymous session without a cookie", async () => {
    const result = await runSession(
      new Request("https://lynvo.test"),
      Layer.succeed(
        ConvexService,
        ConvexService.of({
          query: () => Effect.die(new Error("Unexpected Convex query")),
          mutation: () => Effect.die(new Error("Unexpected Convex mutation")),
        })
      )
    )
    expect(result).toEqual({ user: null })
  })

  it("maps an authenticated Convex Auth session", async () => {
    const result = await runSession(
      new Request("https://lynvo.test", {
        headers: { Cookie: `${AUTH_JWT_COOKIE_NAME}=valid-token` },
      }),
      Layer.succeed(
        ConvexService,
        ConvexService.of({
          query: () =>
            Effect.succeed({
              id: "users:123",
              username: "darshan",
              sessionId: "authSessions:456",
            }),
          mutation: () => Effect.die(new Error("Unexpected Convex mutation")),
        })
      )
    )
    expect(result.user).toEqual({
      id: "users:123",
      username: "darshan",
      sid: "authSessions:456",
    })
    expect(result.accessToken).toBe("valid-token")
  })

  it("resolves an opaque Worker session without exposing the refresh token", async () => {
    const result = await runSession(
      new Request("https://lynvo.test", {
        headers: { Cookie: `${WORKER_SESSION_COOKIE_NAME}=opaque-session-id` },
      }),
      Layer.succeed(
        ConvexService,
        ConvexService.of({
          query: (_query, _args, options) =>
            options?.accessToken === "opaque-session-access-token"
              ? Effect.succeed({
                  id: "users:123",
                  username: "darshan",
                  sessionId: "authSessions:456",
                })
              : Effect.die(new Error("Unexpected access token")),
          mutation: () => Effect.die(new Error("Unexpected Convex mutation")),
        })
      )
    )
    expect(result.accessToken).toBe("opaque-session-access-token")
    expect(result).not.toHaveProperty("refreshToken")
    expect(result.user?.username).toBe("darshan")
  })
})
