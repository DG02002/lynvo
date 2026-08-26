import { Effect } from "effect"
import { describe, expect, it } from "vitest"
import { readScrapeDoAccountInfo } from "~/lib/effect/services/custom-plugin-server-proxy-key"

const accountResponse = (body: string, status = 200) =>
  Promise.resolve(
    new Response(body, {
      status,
      headers: { "Content-Type": "application/json" },
    })
  )

interface ScrapeDoAccountPayload {
  IsActive: boolean
  RemainingMonthlyRequest: number
  MaxMonthlyRequest: number
}

const accountJson = (value: ScrapeDoAccountPayload) => JSON.stringify(value)

describe("readScrapeDoAccountInfo", () => {
  it("returns the monthly balance for an active token", async () => {
    const result = await Effect.runPromise(
      readScrapeDoAccountInfo("user-token", () =>
        accountResponse(
          accountJson({
            IsActive: true,
            RemainingMonthlyRequest: 973,
            MaxMonthlyRequest: 1000,
          })
        )
      )
    )

    expect(result).toEqual({ remaining: 973, limit: 1000 })
  })

  it("fails on rejected tokens", async () => {
    await expect(
      Effect.runPromise(
        readScrapeDoAccountInfo("bad-token", () =>
          accountResponse(JSON.stringify({ error: "invalid token" }), 401)
        )
      )
    ).rejects.toThrow("Scrape.do rejected this API token.")
  })

  it("fails on inactive subscriptions", async () => {
    await expect(
      Effect.runPromise(
        readScrapeDoAccountInfo("inactive-token", () =>
          accountResponse(
            accountJson({
              IsActive: false,
              RemainingMonthlyRequest: 0,
              MaxMonthlyRequest: 1000,
            })
          )
        )
      )
    ).rejects.toThrow("subscription is not active")
  })

  it("fails on unrecognized payloads", async () => {
    await expect(
      Effect.runPromise(
        readScrapeDoAccountInfo("user-token", () => accountResponse("[]"))
      )
    ).rejects.toThrow("unrecognized response")
  })
})
