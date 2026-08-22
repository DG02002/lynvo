import { describe, expect, it } from "vitest"
import {
  parseExtractSuccessContract,
  parseUsageResponseContract,
  validatePluginServerManifestContract,
  validateVerifyErrorContract,
} from "@dg02002/lynvo-plugin-server-protocol"
import app, { manifest } from "../src/index.js"

const environment = {
  LYNVO_PLUGIN_SERVER_API_KEY: "local-test-secret",
}

const authorizedHeaders = {
  Authorization: "Bearer local-test-secret",
}

describe("__PROJECT_DISPLAY_NAME__ Plugin Server contract", () => {
  it("publishes a valid manifest", () => {
    expect(validatePluginServerManifestContract(manifest)).toEqual({
      ok: true,
      issues: [],
    })
  })

  it("publishes a valid manifest behind a TLS-terminating proxy", async () => {
    const response = await app.fetch(
      new Request("http://worker.example/manifest", {
        headers: { "x-forwarded-proto": "https" },
      }),
      environment
    )
    const responseManifest = await response.json()

    expect(response.status).toBe(200)
    expect(validatePluginServerManifestContract(responseManifest)).toEqual({
      ok: true,
      issues: [],
    })
  })

  it("rejects invalid authentication", async () => {
    const response = await app.fetch(
      new Request("https://worker.example/verify", { method: "POST" }),
      environment
    )

    expect(response.status).toBe(401)
    expect(validateVerifyErrorContract(await response.json())).toEqual({
      ok: true,
      issues: [],
    })
  })

  it("publishes finite usage for an authorized request", async () => {
    const response = await app.fetch(
      new Request("https://worker.example/usage", {
        headers: authorizedHeaders,
      }),
      environment
    )

    expect(response.status).toBe(200)
    expect(
      parseUsageResponseContract(await response.json()).value
    ).toMatchObject({
      metrics: [{ id: "example-operations-daily" }],
    })
  })

  it("returns a valid extraction envelope", async () => {
    const response = await app.fetch(
      new Request("https://worker.example/extract", {
        method: "POST",
        headers: { ...authorizedHeaders, "content-type": "application/json" },
        body: JSON.stringify({
          input: {
            kind: "source",
            sourceUrl: "https://media.example.com/video.mp4",
          },
        }),
      }),
      environment
    )

    const parsedBody = parseExtractSuccessContract(await response.json())
    expect(response.status).toBe(200)
    expect(parsedBody).toMatchObject({
      ok: true,
      issues: [],
    })
    expect(parsedBody.value?.nodes[0]).toMatchObject({
      url: "https://media.example.com/video.mp4",
    })
  })
})
