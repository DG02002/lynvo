import { describe, expect, it } from "vitest"

import { RATE_LIMIT_EXPIRES_AT_HEADER } from "../../workers/auth-rate-limiter"
import { createTestRateLimiter } from "../support/rate-limiter"

const mutationRoutes = [
  {
    group: "settings",
    method: "PATCH",
    path: "/api/settings/player",
  },
  {
    group: "plugin-servers",
    method: "POST",
    path: "/api/plugin-servers",
  },
  {
    group: "plugin-domains",
    method: "POST",
    path: "/api/plugin-domains",
  },
  { group: "proxy", method: "POST", path: "/api/proxy/key" },
  { group: "remote", method: "POST", path: "/api/remote/send" },
] as const

describe("Effect API mutation rate limits", () => {
  it.each(mutationRoutes)(
    "returns 429 with Retry-After for $group mutations",
    async ({ group, method, path }) => {
      const { default: worker } = await import("../../workers/app")
      const limiter = createTestRateLimiter(
        () =>
          new Response(null, {
            status: 429,
            headers: {
              [RATE_LIMIT_EXPIRES_AT_HEADER]: String(Date.now() + 8_000),
            },
          })
      )
      // SAFETY: The middleware only reads the environment name and limiter binding.
      const environment = {
        ENVIRONMENT: "production",
        AUTH_RATE_LIMITER: limiter.namespace,
      } as Env
      // SAFETY: The rate-limit response returns before the Effect handler runs.
      const executionContext = {
        waitUntil: () => undefined,
      } as ExecutionContext
      const response = await worker.fetch(
        new Request(`https://lynvo.test${path}`, {
          method,
          headers: { "CF-Connecting-IP": "192.0.2.10" },
        }),
        environment,
        executionContext
      )

      expect(response.status).toBe(429)
      expect(Number(response.headers.get("Retry-After"))).toBeGreaterThan(0)
      expect(limiter.calls.map(({ key }) => key)).toEqual([
        `effect-mutation:${group}:192.0.2.10`,
      ])
      await expect(response.json()).resolves.toMatchObject({
        code: "rate_limited",
        retryable: true,
      })
    }
  )

  it.each(mutationRoutes)(
    "fails closed with 503 for $group mutations when the limiter is unavailable",
    async ({ method, path }) => {
      const { default: worker } = await import("../../workers/app")
      const limiter = createTestRateLimiter(
        () => new Response(null, { status: 500 })
      )
      // SAFETY: The middleware only reads the environment name and limiter binding.
      const environment = {
        ENVIRONMENT: "production",
        AUTH_RATE_LIMITER: limiter.namespace,
      } as Env
      // SAFETY: The unavailable limiter response returns before the Effect handler runs.
      const executionContext = {
        waitUntil: () => undefined,
      } as ExecutionContext
      const response = await worker.fetch(
        new Request(`https://lynvo.test${path}`, {
          method,
          headers: { "CF-Connecting-IP": "192.0.2.10" },
        }),
        environment,
        executionContext
      )

      expect(response.status).toBe(503)
      await expect(response.json()).resolves.toMatchObject({
        code: "service_unavailable",
        retryable: true,
      })
      expect(limiter.calls).toHaveLength(1)
    }
  )
})
