import { describe, expect, it } from "vitest"
import { Result, Schema } from "effect"
import {
  createNodeExtractRequest,
  createSourceExtractRequest,
  getLynvoManifestExtension,
  parsePluginServerManifestContract,
  pluginMetadataSchema,
  pluginServerManifestSchema,
  resolvableNodeSchema,
  validatePluginServerManifestContract,
  validPluginServerManifestFixture,
} from "../src/index"

describe("Lynvo manifest source credentials", () => {
  it("preserves optional resolvable-node semantics", () => {
    expect(
      Schema.decodeUnknownSync(resolvableNodeSchema)({
        kind: "resolvable",
        label: "Lazy folder",
        nodeUrl: "https://example.com/folder/",
        resolutionKind: "folder",
      })
    ).toMatchObject({ resolutionKind: "folder" })
  })

  it("accepts backward-compatible source capability metadata", () => {
    const manifest = Schema.decodeUnknownSync(pluginServerManifestSchema)({
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
    const manifest = Schema.decodeUnknownSync(pluginServerManifestSchema)({
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

  it("accepts only manifests that satisfy the complete Plugin Server contract", () => {
    const { usage: declaredUsage, ...manifestWithoutUsage } =
      validPluginServerManifestFixture

    expect(
      parsePluginServerManifestContract(validPluginServerManifestFixture).value
        ?.pluginServerId
    ).toBe("dev.lynvo.example-plugin-server")
    expect(
      parsePluginServerManifestContract(manifestWithoutUsage)
    ).toMatchObject({
      ok: false,
      issues: [
        {
          path: "usage",
          message: "Declare the mandatory authenticated /usage endpoint.",
        },
      ],
    })
    expect(declaredUsage).toEqual({ endpoint: "/usage" })
  })

  it("reports duplicate Plugin ids through the typed parser result", () => {
    const duplicatePluginManifest = {
      ...validPluginServerManifestFixture,
      extensions: {
        lynvo: {
          plugins: [
            {
              id: "duplicate-plugin",
              displayName: "First Plugin",
              status: "active",
              version: "1.0.0",
              hosts: ["first.example"],
            },
            {
              id: "duplicate-plugin",
              displayName: "Second Plugin",
              status: "active",
              version: "1.0.0",
              hosts: ["second.example"],
            },
          ],
        },
      },
    }

    expect(
      parsePluginServerManifestContract(duplicatePluginManifest)
    ).toMatchObject({
      ok: false,
      issues: [
        {
          path: "extensions.lynvo.plugins.1.id",
          message: "Duplicate source id: duplicate-plugin",
        },
      ],
    })
  })

  it("reports icon capability and URL mismatches", () => {
    const invalidIconManifest = {
      ...validPluginServerManifestFixture,
      hasIcon: false,
      iconUrl: "https://icons.example/server.jpg",
      extensions: {
        lynvo: {
          plugins: [
            {
              id: "example-plugin",
              displayName: "Example Plugin",
              hasIcon: false,
              iconUrl: "https://icons.example/plugin.webp",
              status: "active",
              version: "1.0.0",
              hosts: ["example.com"],
            },
          ],
        },
      },
    }

    expect(
      validatePluginServerManifestContract(invalidIconManifest).issues
    ).toEqual(
      expect.arrayContaining([
        {
          path: "iconUrl",
          message:
            "Use a direct HTTPS WebP, PNG, or SVG URL for Plugin Server icons.",
        },
        {
          path: "hasIcon",
          message: "Set hasIcon to true when iconUrl is present.",
        },
        {
          path: "extensions.lynvo.plugins.0.hasIcon",
          message: "Set hasIcon to true when iconUrl is present.",
        },
      ])
    )
  })

  it("keeps the new fields optional for existing manifests", () => {
    const manifest = Schema.decodeUnknownSync(pluginServerManifestSchema)({
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

  it("preserves Plugin usageMultiplier metadata through the manifest contract", () => {
    const manifest = Schema.decodeUnknownSync(pluginServerManifestSchema)({
      protocolVersion: "1.0",
      pluginServerId: "dev.lynvo.test",
      displayName: "Test",
      auth: { type: "bearer" },
      usage: { endpoint: "/usage" },
      matchers: [{ hosts: ["example.com"] }],
      features: {},
      extensions: {
        lynvo: {
          plugins: [
            {
              id: "render-plugin",
              displayName: "Render Plugin",
              version: "1.0.0",
              usageMultiplier: 5,
              proxyCreditUsage: "Uses 5 proxy credits for rendering.",
              hosts: ["example.com"],
            },
          ],
        },
      },
    })

    expect(getLynvoManifestExtension(manifest).plugins?.[0]).toMatchObject({
      usageMultiplier: 5,
      proxyCreditUsage: "Uses 5 proxy credits for rendering.",
    })
    expect(
      Result.isFailure(
        Schema.decodeUnknownResult(pluginMetadataSchema)({
          id: "render-plugin",
          displayName: "Render Plugin",
          hosts: ["example.com"],
          usageMultiplier: 0,
        })
      )
    ).toBe(true)
  })

  it("preserves the server-level proxyProvider capability through the extension", () => {
    const manifest = Schema.decodeUnknownSync(pluginServerManifestSchema)({
      protocolVersion: "1.0",
      pluginServerId: "dev.lynvo.test",
      displayName: "Test",
      auth: { type: "bearer" },
      usage: { endpoint: "/usage" },
      matchers: [{ hosts: ["example.com"] }],
      features: {},
      extensions: {
        lynvo: {
          proxyProvider: "scrape-do",
          plugins: [
            { id: "source", displayName: "Source", hosts: ["example.com"] },
          ],
        },
      },
    })

    expect(getLynvoManifestExtension(manifest).proxyProvider).toBe("scrape-do")
    expect(getLynvoManifestExtension(manifest).plugins).toHaveLength(1)
  })

  it("round-trips a user proxy credential through the extract request", () => {
    const request = createSourceExtractRequest({
      sourceUrl: "https://example.com/file",
      proxy: { provider: "scrape-do", token: "user-token" },
    })

    expect(request).toMatchObject({
      input: { kind: "source", sourceUrl: "https://example.com/file" },
      proxy: { provider: "scrape-do", token: "user-token" },
    })
    expect(
      createNodeExtractRequest({ nodeUrl: "https://example.com/node" }).proxy
    ).toBeUndefined()
  })

  it("accepts probe-matched Plugins without URL matchers and rejects ambiguous combinations", () => {
    const probePluginManifest = {
      ...validPluginServerManifestFixture,
      extensions: {
        lynvo: {
          plugins: [
            {
              id: "generic-media-probe",
              displayName: "Generic Media Probe",
              status: "active",
              version: "1.0.0",
              hosts: [],
              matchStrategy: "probe",
            },
          ],
        },
      },
    }

    expect(
      parsePluginServerManifestContract(probePluginManifest)
    ).toMatchObject({
      ok: true,
      value: {
        extensions: {
          lynvo: {
            plugins: [
              {
                id: "generic-media-probe",
                matchStrategy: "probe",
              },
            ],
          },
        },
      },
    })
    expect(
      parsePluginServerManifestContract({
        ...probePluginManifest,
        extensions: {
          lynvo: {
            plugins: [
              {
                ...probePluginManifest.extensions.lynvo.plugins[0],
                matchers: [{ hosts: ["*"] }],
              },
            ],
          },
        },
      })
    ).toMatchObject({
      ok: false,
      issues: [
        {
          path: "extensions.lynvo.plugins.0.matchers",
          message: "Probe-matched Plugins cannot declare hosts or matchers.",
        },
      ],
    })
  })
})
