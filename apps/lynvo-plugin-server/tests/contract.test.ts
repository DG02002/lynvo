import { exports } from "cloudflare:workers"
import { Result, Schema } from "effect"
import { describe, expect, it } from "vitest"
import {
  extractErrorSchema,
  validatePluginServerManifestContract,
  validateExtractSuccessContract,
  validateUsageContract,
} from "@dg02002/lynvo-plugin-server-protocol"
import { GLOBAL_DAILY_OPERATION_LIMIT } from "../src/constants"
import {
  clearUsageCounters,
  currentUsagePeriodKeys,
  setUsageCounters,
} from "./usage-limiter-test-helpers"

const authenticatedHeaders = {
  Authorization: "Bearer test-api-key",
  "Content-Type": "application/json",
}

describe("Lynvo Plugin Server protocol routes", () => {
  it("serves a public valid manifest", async () => {
    const response = await exports.default.fetch(
      "https://worker.example/manifest"
    )
    const manifest: unknown = await response.json()

    expect(response.status).toBe(200)
    expect(validatePluginServerManifestContract(manifest)).toEqual({
      ok: true,
      issues: [],
    })
  })

  it("requires the configured bearer credential", async () => {
    const denied = await exports.default.fetch(
      "https://worker.example/verify",
      {
        method: "POST",
      }
    )
    const accepted = await exports.default.fetch(
      "https://worker.example/verify",
      {
        method: "POST",
        headers: authenticatedHeaders,
      }
    )

    expect(denied.status).toBe(401)
    expect(await denied.json()).toMatchObject({
      error: { code: "AUTH_INVALID" },
    })
    expect(accepted.status).toBe(200)
    expect(await accepted.json()).toEqual({ ok: true })
  })

  it("reports finite enforced usage", async () => {
    const response = await exports.default.fetch(
      "https://worker.example/usage",
      {
        headers: authenticatedHeaders,
      }
    )
    const usage: unknown = await response.json()

    expect(response.status).toBe(200)
    expect(validateUsageContract(usage)).toEqual({ ok: true, issues: [] })
  })

  it("discovers index URLs without Lynvo knowing their URL pattern", async () => {
    const response = await exports.default.fetch(
      "https://worker.example/discover",
      {
        method: "POST",
        headers: authenticatedHeaders,
        body: JSON.stringify({
          url: "https://unknown.example/0:/Collections/",
        }),
      }
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      matched: true,
      pluginId: "bhadoo-google-drive-index",
      confidence: "pattern",
    })
  })

  it("does not claim unrelated URLs during discovery", async () => {
    const response = await exports.default.fetch(
      "https://worker.example/discover",
      {
        method: "POST",
        headers: authenticatedHeaders,
        body: JSON.stringify({ url: "https://unknown.example/movies/" }),
      }
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ matched: false })
  })

  it("extracts a direct drive-index media node", async () => {
    const response = await exports.default.fetch(
      "https://worker.example/extract",
      {
        method: "POST",
        headers: authenticatedHeaders,
        body: JSON.stringify({
          pluginId: "bhadoo-google-drive-index",
          input: {
            kind: "source",
            sourceUrl:
              "https://drive.example/0:/Collections/example.mkv?a=view",
          },
        }),
      }
    )
    const result: unknown = await response.json()

    expect(response.status).toBe(200)
    expect(validateExtractSuccessContract(result)).toEqual({
      ok: true,
      issues: [],
    })
    expect(result).toMatchObject({
      plugin: { pluginId: "bhadoo-google-drive-index" },
      nodes: [{ kind: "playable", label: "example.mkv" }],
    })
  })

  it("keeps schema-valid non-URL input inside the protocol envelope", async () => {
    const response = await exports.default.fetch(
      "https://worker.example/extract",
      {
        method: "POST",
        headers: authenticatedHeaders,
        body: JSON.stringify({
          pluginId: "direct-media",
          input: { kind: "source", sourceUrl: "not-a-url" },
        }),
      }
    )

    // Keep this focused on the protocol envelope; the source-specific error
    // code is not part of the logging regression.
    expect(response.ok).toBe(false)
    expect(response.headers.get("content-type")).toContain("application/json")
    const result: unknown = await response.json()
    expect(
      Result.isSuccess(Schema.decodeUnknownResult(extractErrorSchema)(result))
    ).toBe(true)
  })

  it("returns retry guidance when extraction capacity is exhausted", async () => {
    const periodKeys = currentUsagePeriodKeys()
    try {
      await setUsageCounters(periodKeys, GLOBAL_DAILY_OPERATION_LIMIT)
      const response = await exports.default.fetch(
        "https://worker.example/extract",
        {
          method: "POST",
          headers: authenticatedHeaders,
          body: JSON.stringify({
            pluginId: "direct-media",
            input: {
              kind: "source",
              sourceUrl: "https://media.example/video.mp4",
            },
          }),
        }
      )

      const result: unknown = await response.json()
      expect(response.status).toBe(429)
      expect(response.headers.get("retry-after")).toMatch(/^\d+$/)
      expect(result).toMatchObject({
        ok: false,
        error: {
          code: "RATE_LIMITED",
          retryAfterSeconds: expect.any(Number),
        },
      })
    } finally {
      await clearUsageCounters(periodKeys)
    }
  })

  it("returns a protocol envelope for unknown routes", async () => {
    const response = await exports.default.fetch(
      "https://worker.example/unknown"
    )
    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "BAD_REQUEST" },
    })
  })
})
