import { describe, expect, it } from "vitest"

describe("public Extraction abuse control", () => {
  it.each([
    ["/api/extract?url=https%3A%2F%2Fsource.example", "extraction"],
    ["/api/meta?url=https%3A%2F%2Fsource.example", "metadata"],
  ])("returns a stable 429 for %s independently", async (path, policy) => {
    const keys: string[] = []
    const { default: worker } = await import("../../workers/app")
    // SAFETY: This route only uses the environment and rate-limiter binding supplied here.
    const environment = {
      ENVIRONMENT: "production",
      AUTH_RATE_LIMITER: {
        getByName: (key: string) => {
          keys.push(key)
          return {
            fetch: async () => new Response(null, { status: 429 }),
          }
        },
      },
    } as Env
    // SAFETY: The route only calls waitUntil on this execution context.
    const executionContext = { waitUntil: () => undefined } as ExecutionContext
    const response = await worker.fetch(
      new Request(`https://lynvo.test${path}`, {
        headers: { "CF-Connecting-IP": "192.0.2.10" },
      }),
      environment,
      executionContext
    )

    expect(response.status).toBe(429)
    expect(keys).toEqual([`${policy}:192.0.2.10`])
    await expect(response.json()).resolves.toMatchObject({
      code: "rate_limited",
      retryable: true,
    })
  })
})
