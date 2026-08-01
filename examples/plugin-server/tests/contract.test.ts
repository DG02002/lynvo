import { describe, expect, it } from "vitest"
import {
  validatePluginServerManifestContract,
  validateExtractSuccessContract,
  parseUsageResponseContract,
  verifyErrorSchema,
} from "@lynvo/plugin-server-protocol"
import worker, { manifest } from "../src/index"

const environment = {}

describe("example Plugin Server contract", () => {
  it("publishes a valid manifest", () => {
    expect(validatePluginServerManifestContract(manifest)).toEqual({
      ok: true,
      issues: [],
    })
  })

  it("returns a valid extraction envelope", async () => {
    const response = await worker.fetch(
      new Request("https://worker.example/extract", {
        method: "POST",
        headers: { Authorization: "Bearer example-secret" },
        body: JSON.stringify({
          input: {
            kind: "source",
            sourceUrl: "https://media.example.com/video.mp4",
          },
        }),
      }),
      environment
    )
    expect(validateExtractSuccessContract(await response.json())).toEqual({
      ok: true,
      issues: [],
    })
  })

  it("publishes finite usage and rejects invalid authentication", async () => {
    const usageResponse = await worker.fetch(
      new Request("https://worker.example/usage", {
        headers: { Authorization: "Bearer example-secret" },
      }),
      environment
    )
    expect(
      parseUsageResponseContract(await usageResponse.json()).value
    ).toMatchObject({
      metrics: [{ id: "example-operations-daily" }],
    })

    const unauthorizedResponse = await worker.fetch(
      new Request("https://worker.example/verify", { method: "POST" }),
      environment
    )
    expect(unauthorizedResponse.status).toBe(401)
    expect(
      verifyErrorSchema.safeParse(await unauthorizedResponse.json()).success
    ).toBe(true)
  })
})
