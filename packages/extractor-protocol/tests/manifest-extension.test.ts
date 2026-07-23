import { describe, expect, it } from "vitest"
import {
  getLynvoManifestExtension,
  manifestSchema,
  validateExtractorManifestContract,
} from "../src/index"

describe("Lynvo manifest source credentials", () => {
  it("accepts backward-compatible source capability metadata", () => {
    const manifest = manifestSchema.parse({
      protocolVersion: "1.0",
      extractorId: "dev.lynvo.test",
      displayName: "Test",
      hasIcon: false,
      auth: { type: "bearer" },
      usage: { endpoint: "/usage" },
      matchers: [{ hosts: ["example.com"] }],
      features: { password: true, lazyNodes: true, basicAuth: true },
      extensions: {
        lynvo: {
          sources: [
            {
              id: "source",
              displayName: "Source",
              description: "A source adapter.",
              homepage: "https://example.com",
              hasIcon: false,
              hosts: ["example.com"],
              credential: {
                kind: "domain-password",
                scope: "domain",
                required: false,
              },
            },
          ],
        },
      },
    })

    expect(getLynvoManifestExtension(manifest).sources?.[0]).toMatchObject({
      description: "A source adapter.",
      homepage: "https://example.com",
      hasIcon: false,
      credential: {
        kind: "domain-password",
        scope: "domain",
        required: false,
      },
    })
  })

  it("rejects explicit icon capabilities that disagree with iconUrl", () => {
    const manifest = manifestSchema.parse({
      protocolVersion: "1.0",
      extractorId: "dev.lynvo.test",
      displayName: "Test",
      hasIcon: true,
      auth: { type: "bearer" },
      usage: { endpoint: "/usage" },
      matchers: [{ hosts: ["example.com"] }],
      features: {},
      extensions: { lynvo: { sources: [] } },
    })

    expect(validateExtractorManifestContract(manifest).issues).toContainEqual({
      path: "iconUrl",
      message: "Provide iconUrl when hasIcon is true.",
    })
  })

  it("keeps the new fields optional for existing manifests", () => {
    const manifest = manifestSchema.parse({
      protocolVersion: "1.0",
      extractorId: "dev.lynvo.test",
      displayName: "Test",
      auth: { type: "bearer" },
      usage: { endpoint: "/usage" },
      matchers: [{ hosts: ["example.com"] }],
      features: {},
      extensions: { lynvo: { sources: [] } },
    })
    expect(getLynvoManifestExtension(manifest)).toEqual({ sources: [] })
  })
})
