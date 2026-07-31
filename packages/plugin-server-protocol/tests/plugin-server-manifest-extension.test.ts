import { describe, expect, it } from "vitest"
import {
  getLynvoManifestExtension,
  pluginServerManifestSchema,
  resolvableNodeSchema,
  validatePluginServerManifestContract,
} from "../src/index"

describe("Lynvo manifest source credentials", () => {
  it("preserves optional resolvable-node semantics", () => {
    expect(
      resolvableNodeSchema.parse({
        kind: "resolvable",
        label: "Lazy folder",
        nodeUrl: "https://example.com/folder/",
        resolutionKind: "folder",
      })
    ).toMatchObject({ resolutionKind: "folder" })
  })

  it("accepts backward-compatible source capability metadata", () => {
    const manifest = pluginServerManifestSchema.parse({
      protocolVersion: "1.0",
      pluginServerId: "dev.lynvo.test",
      displayName: "Test",
      hasIcon: false,
      auth: { type: "bearer" },
      usage: { endpoint: "/usage" },
      matchers: [{ hosts: ["example.com"] }],
      features: { password: true, lazyNodes: true, basicAuth: true },
      extensions: {
        lynvo: {
          plugins: [
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

    expect(getLynvoManifestExtension(manifest).plugins?.[0]).toMatchObject({
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
    const manifest = pluginServerManifestSchema.parse({
      protocolVersion: "1.0",
      pluginServerId: "dev.lynvo.test",
      displayName: "Test",
      hasIcon: true,
      auth: { type: "bearer" },
      usage: { endpoint: "/usage" },
      matchers: [{ hosts: ["example.com"] }],
      features: {},
      extensions: { lynvo: { plugins: [] } },
    })

    expect(
      validatePluginServerManifestContract(manifest).issues
    ).toContainEqual({
      path: "iconUrl",
      message: "Provide iconUrl when hasIcon is true.",
    })
  })

  it("keeps the new fields optional for existing manifests", () => {
    const manifest = pluginServerManifestSchema.parse({
      protocolVersion: "1.0",
      pluginServerId: "dev.lynvo.test",
      displayName: "Test",
      auth: { type: "bearer" },
      usage: { endpoint: "/usage" },
      matchers: [{ hosts: ["example.com"] }],
      features: {},
      extensions: { lynvo: { plugins: [] } },
    })
    expect(getLynvoManifestExtension(manifest)).toEqual({ plugins: [] })
  })
})
