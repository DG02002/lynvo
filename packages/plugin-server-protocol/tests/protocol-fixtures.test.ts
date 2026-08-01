import { describe, expect, it } from "vitest"
import {
  extractErrorSchema,
  extractSuccessSchema,
  pluginServerManifestSchema,
  usageResponseSchema,
  validExtractErrorFixture,
  validExtractSuccessFixture,
  validPluginServerManifestFixture,
  validUsageResponseFixture,
} from "../src/index"

describe("Plugin Server protocol fixtures", () => {
  it("keeps every canonical fixture executable", () => {
    expect(pluginServerManifestSchema.safeParse(validPluginServerManifestFixture).success).toBe(true)
    expect(usageResponseSchema.safeParse(validUsageResponseFixture).success).toBe(true)
    expect(extractSuccessSchema.safeParse(validExtractSuccessFixture).success).toBe(true)
    expect(extractErrorSchema.safeParse(validExtractErrorFixture).success).toBe(true)
  })

  it("rejects the obsolete source response envelope", () => {
    expect(
      extractSuccessSchema.safeParse({
        source: validExtractSuccessFixture.plugin,
        nodes: [],
        extensions: {},
      }).success
    ).toBe(false)
  })
})
