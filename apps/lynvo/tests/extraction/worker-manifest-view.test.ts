import { describe, expect, it } from "vitest"
import { getMatchedExtractorSource } from "@lynvo/extractor-protocol"
import { getWorkerManifestView } from "~/features/site/settings/plugin-worker-manifest"

describe("getWorkerManifestView", () => {
  it("exposes external extractor icons from protocol manifests", () => {
    const view = getWorkerManifestView(
      JSON.stringify({
        protocolVersion: "1.0",
        extractorId: "com.example.extractor",
        displayName: "Example Extractor",
        iconUrl: "https://extractor.example/icon.svg",
        auth: { type: "bearer" },
        matchers: [{ hosts: ["example.com"], pathPatterns: ["/**"] }],
        features: { password: true, lazyNodes: true },
        extensions: {},
      })
    )

    expect(view.name).toBe("Example Extractor")
    expect(view.icon).toBe("https://extractor.example/icon.svg")
    expect(view.hosts).toBe("example.com")
  })

  it("exposes external worker source plugin icons from Lynvo manifest extensions", () => {
    const view = getWorkerManifestView(
      JSON.stringify({
        protocolVersion: "1.0",
        extractorId: "com.example.extractor",
        displayName: "Example Extractor",
        auth: { type: "bearer" },
        matchers: [{ hosts: ["resolver-beta.example"], pathPatterns: ["/**"] }],
        features: { password: true, lazyNodes: true },
        extensions: {
          lynvo: {
            sources: [
              {
                id: "resolver-beta",
                displayName: "Resolver Beta",
                iconUrl: "https://icons.example/resolver-beta.svg",
                status: "maintenance",
                version: "1.2.3",
                hosts: ["resolver-beta.example"],
              },
            ],
          },
        },
      })
    )

    expect(view.sources).toEqual([
      {
        id: "resolver-beta",
        displayName: "Resolver Beta",
        iconUrl: "https://icons.example/resolver-beta.svg",
        status: "maintenance",
        version: "1.2.3",
        hosts: ["resolver-beta.example"],
      },
    ])
  })

  it("matches source plugin metadata using source matchers", () => {
    const manifest = {
      protocolVersion: "1.0" as const,
      extractorId: "com.example.extractor",
      displayName: "Example Extractor",
      auth: { type: "bearer" as const },
      matchers: [
        { hosts: ["resolver-beta.example"], hostPatterns: ["*resolver-beta*"] },
      ],
      features: { password: true, lazyNodes: true },
      extensions: {
        lynvo: {
          sources: [
            {
              id: "resolver-beta",
              displayName: "Resolver Beta",
              iconUrl: "https://icons.example/resolver-beta.svg",
              status: "active" as const,
              version: "1.0.0",
              hosts: ["resolver-beta.example"],
              matchers: [
                {
                  hosts: ["resolver-beta.example"],
                  hostPatterns: ["*resolver-beta*"],
                },
              ],
            },
          ],
        },
      },
    }

    const source = getMatchedExtractorSource(
      manifest,
      "https://new-resolver-beta-host.example/file"
    )

    expect(source?.displayName).toBe("Resolver Beta")
  })

  it("upgrades stale source icons and fills missing worker icon URLs", () => {
    const view = getWorkerManifestView(
      JSON.stringify({
        protocolVersion: "1.0",
        extractorId: "com.example.extractor",
        displayName: "Example Extractor",
        auth: { type: "bearer" },
        matchers: [{ hosts: ["example.com"] }],
        features: {},
        extensions: {
          lynvo: {
            sources: [
              {
                id: "first-source",
                displayName: "First source",
                iconUrl: "http://localhost:8788/icons/plugins/first-source.png",
              },
              { id: "second-source", displayName: "Second source" },
            ],
          },
        },
      }),
      "http://localhost:8788/"
    )

    expect(view.sources.map((source) => source.iconUrl)).toEqual([
      "http://localhost:8788/icons/plugins/first-source.webp",
      "http://localhost:8788/icons/plugins/second-source.webp",
    ])
  })
})
