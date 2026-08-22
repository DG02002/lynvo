import { describe, expect, it } from "vitest"
import { Result, Schema } from "effect"
import {
  extractErrorSchema,
  extractSuccessSchema,
  parseExtractSuccessContract,
  parseUsageResponseContract,
  pluginServerManifestSchema,
  validateUsageContract,
  usageResponseSchema,
  validExtractErrorFixture,
  validExtractSuccessFixture,
  validPluginServerManifestFixture,
  validUsageResponseFixture,
  createPluginServerRuntime,
} from "../src/index"

describe("Plugin Server protocol fixtures", () => {
  it("keeps every canonical fixture executable", () => {
    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(pluginServerManifestSchema)(
          validPluginServerManifestFixture
        )
      )
    ).toBe(true)
    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(usageResponseSchema)(
          validUsageResponseFixture
        )
      )
    ).toBe(true)
    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(extractSuccessSchema)(
          validExtractSuccessFixture
        )
      )
    ).toBe(true)
    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(extractErrorSchema)(validExtractErrorFixture)
      )
    ).toBe(true)
  })

  it("allows an explicitly selected probe Plugin to inspect an unmatched URL", async () => {
    const manifest = {
      ...validPluginServerManifestFixture,
      extensions: {
        lynvo: {
          plugins: [
            {
              id: "generic-media-probe",
              displayName: "Generic Media Probe",
              status: "active" as const,
              version: "1.0.0",
              matchStrategy: "probe" as const,
              hosts: [],
            },
          ],
        },
      },
    }
    const runtime = createPluginServerRuntime({
      manifest,
      auth: { validate: () => true },
      usage: () => validUsageResponseFixture,
      extract: () => ({
        ...validExtractSuccessFixture,
        plugin: {
          ...validExtractSuccessFixture.plugin,
          pluginId: "generic-media-probe",
        },
      }),
    })

    const response = await runtime.handleExtract(
      new Request("https://plugin-server.example/extract", {
        method: "POST",
        body: JSON.stringify({
          pluginId: "generic-media-probe",
          input: {
            kind: "source",
            sourceUrl: "https://unmatched.example/video.mp4",
          },
        }),
      }),
      {}
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      plugin: { pluginId: "generic-media-probe" },
    })
  })

  it("rejects the obsolete source response envelope", () => {
    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(extractSuccessSchema)({
          source: validExtractSuccessFixture.plugin,
          nodes: [],
          extensions: {},
        })
      )
    ).toBe(false)
  })

  it("accepts playable health and expiry metadata", () => {
    const response = {
      ...validExtractSuccessFixture,
      nodes: [
        {
          kind: "playable",
          label: "Signed video",
          url: "https://media.example.com/signed-video",
          status: "up",
          rangeRequest: "supported",
          expiry: 1_798_761_600_000,
          expirySource: "signed-url",
        },
      ],
    }

    expect(
      Result.isSuccess(
        Schema.decodeUnknownResult(extractSuccessSchema)(response)
      )
    ).toBe(true)
  })

  it("accepts only usage responses within their declared finite limits", () => {
    const invalidUsageResponse = {
      ...validUsageResponseFixture,
      metrics: [
        {
          ...validUsageResponseFixture.metrics[0],
          used: 1_001,
        },
      ],
    }

    expect(
      parseUsageResponseContract(validUsageResponseFixture).value?.metrics[0]
    ).toMatchObject({ used: 0, limit: 1_000 })
    expect(parseUsageResponseContract(invalidUsageResponse)).toMatchObject({
      ok: false,
      issues: [
        {
          path: "metrics.0.used",
          message: "Usage cannot exceed its finite limit.",
        },
      ],
    })
  })

  it("reports duplicate usage metric ids through the typed parser result", () => {
    const duplicateMetricResponse = {
      ...validUsageResponseFixture,
      metrics: [
        validUsageResponseFixture.metrics[0],
        { ...validUsageResponseFixture.metrics[0], label: "Duplicate metric" },
      ],
    }

    expect(
      validateUsageContract(duplicateMetricResponse).issues
    ).toContainEqual({
      path: "metrics.1.id",
      message: "Duplicate metric id: example-operations-daily",
    })
    expect(parseUsageResponseContract(duplicateMetricResponse)).toMatchObject({
      ok: false,
      issues: [
        {
          path: "metrics.1.id",
          message: "Duplicate metric id: example-operations-daily",
        },
      ],
    })
  })

  it("accepts only extraction responses with valid icon metadata", () => {
    const invalidExtractSuccessResponse = {
      ...validExtractSuccessFixture,
      plugin: {
        ...validExtractSuccessFixture.plugin,
        pluginIconUrl: "https://media.example.com/plugin.jpg",
      },
    }

    expect(
      parseExtractSuccessContract(validExtractSuccessFixture).value?.plugin
    ).toMatchObject({ pluginServerId: "dev.lynvo.example-plugin-server" })
    expect(
      parseExtractSuccessContract(invalidExtractSuccessResponse)
    ).toMatchObject({
      ok: false,
      issues: [
        {
          path: "plugin.pluginIconUrl",
          message:
            "Use a direct HTTPS WebP, PNG, or SVG URL for Plugin icons.",
        },
      ],
    })
  })
})
