import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"
import app from "../../workers/app"
import { D1_SESSION_COOKIE_NAME } from "../../workers/constants"
import { createDeviceCode } from "../../workers/d1/device-auth"
import { createSession } from "../../workers/d1/sessions"
import { insertGoogleUser } from "../../workers/d1/users"

const APPROVAL_RATE_LIMIT = 10
const CLIENT_IP = "192.0.2.44"

const createRateLimiter = (limit: number) => {
  const attempts = new Map<string, number>()
  const keys: string[] = []
  // SAFETY: The route only calls getByName and the returned fetch method on this namespace stub.
  const namespace = {
    getByName(key: string) {
      keys.push(key)
      return {
        fetch: async () => {
          const attempt = attempts.get(key) ?? 0
          attempts.set(key, attempt + 1)
          return new Response(null, {
            status: attempt < limit ? 200 : 429,
          })
        },
      }
    },
  } as DurableObjectNamespace
  return { keys, namespace }
}

const keysFor = (keys: readonly string[], userId: string): string[] =>
  keys.filter((key) => key === `auth:device-approval:${CLIENT_IP}:${userId}`)

describe("device approval Worker route", () => {
  it("keeps approval lookup available under the limit and returns the sibling 429 shape after it", async () => {
    const user = await insertGoogleUser(env.DB, {
      googleSubject: `subject-${crypto.randomUUID()}`,
      email: `device-approval-${crypto.randomUUID()}@example.com`,
      now: Date.now(),
    })
    const session = await createSession(env.DB, {
      userId: user.id,
      now: Date.now(),
    })
    const deviceCode = await createDeviceCode(env.DB, {
      deviceName: "Living room TV",
      now: Date.now(),
    })
    const limiter = createRateLimiter(APPROVAL_RATE_LIMIT)
    // SAFETY: The route only uses the D1 database, environment name, and rate-limiter binding supplied here.
    const environment = {
      DB: env.DB,
      ENVIRONMENT: "production",
      AUTH_RATE_LIMITER: limiter.namespace,
    } as Env
    const request = () =>
      new Request(
        `https://lynvo.test/api/auth/device/approval?code=${encodeURIComponent(deviceCode.code)}`,
        {
          headers: {
            Cookie: `${D1_SESSION_COOKIE_NAME}=${session.id}`,
            "CF-Connecting-IP": CLIENT_IP,
          },
        }
      )

    const underLimitResponses = await Promise.all(
      Array.from({ length: APPROVAL_RATE_LIMIT }, () =>
        app.fetch(request(), environment)
      )
    )
    expect(
      underLimitResponses.every((response) => response.status === 200)
    ).toBe(true)
    await expect(underLimitResponses[0]?.json()).resolves.toEqual({
      code: deviceCode.code,
      status: "pending",
      deviceName: "Living room TV",
      expiresAt: deviceCode.expiresAt,
    })

    const limitedResponse = await app.fetch(request(), environment)
    expect(limitedResponse.status).toBe(429)
    await expect(limitedResponse.text()).resolves.toBe(
      "Too many attempts. Try again later."
    )
    expect(keysFor(limiter.keys, user.id)).toHaveLength(APPROVAL_RATE_LIMIT + 1)
  })
})
