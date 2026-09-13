import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"
import app from "../../workers/app"
import {
  D1_SESSION_COOKIE_NAME,
  DEVICE_APPROVAL_RATE_LIMIT,
  DEVICE_APPROVAL_RATE_WINDOW_SECONDS,
} from "../../workers/constants"
import { createDeviceCode } from "../../workers/d1/device-auth"
import { createSession } from "../../workers/d1/sessions"
import { insertGoogleUser } from "../../workers/d1/users"
import { createTestRateLimiter } from "../support/rate-limiter"

const CLIENT_IP = "192.0.2.44"

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
    const limiter = createTestRateLimiter(
      ({ attempt }) =>
        new Response(null, {
          status: attempt < DEVICE_APPROVAL_RATE_LIMIT ? 200 : 429,
        })
    )
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
      Array.from({ length: DEVICE_APPROVAL_RATE_LIMIT }, () =>
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
    expect(limiter.calls.map(({ key }) => key)).toEqual(
      Array.from(
        { length: DEVICE_APPROVAL_RATE_LIMIT + 1 },
        () => `auth:device-approval:${CLIENT_IP}:${user.id}`
      )
    )
    for (const { init } of limiter.calls) {
      expect(JSON.parse(String(init?.body))).toMatchObject({
        limit: DEVICE_APPROVAL_RATE_LIMIT,
        windowMs: DEVICE_APPROVAL_RATE_WINDOW_SECONDS * 1_000,
      })
    }

    const unavailableLimiter = createTestRateLimiter(
      () => new Response(null, { status: 500 })
    )
    const unavailableResponse = await app.fetch(request(), {
      ...environment,
      AUTH_RATE_LIMITER: unavailableLimiter.namespace,
    })
    expect(unavailableResponse.status).toBe(503)
    await expect(unavailableResponse.text()).resolves.toBe(
      "Device approval is unavailable. Try again later."
    )
  })
})
