import { describe, expect, it } from "vitest"
import { getMatchedPlugin } from "@lynvo/plugin-server-protocol"
import { getWorkerManifestView } from "~/features/site/settings/plugin-worker-manifest"

describe("getWorkerManifestView", () => {
  it("exposes external extractor icons from protocol manifests", () => {
    const view = getWorkerManifestView(
      JSON.stringify({
        protocolVersion: "1.0",
        pluginServerId: "com.example.extractor",
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

  it("exposes extractor source icons from Lynvo manifest extensions", () => {
    const view = getWorkerManifestView(
      JSON.stringify({
        protocolVersion: "1.0",
        pluginServerId: "com.example.extractor",
        displayName: "Example Extractor",
        auth: { type: "bearer" },
        matchers: [{ hosts: ["resolver-beta.example"], pathPatterns: ["/**"] }],
        features: { password: true, lazyNodes: true },
        extensions: {
          lynvo: {
            plugins: [
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

    expect(view.plugins).toEqual([
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

  it("matches extractor source metadata using source matchers", () => {
    const manifest = {
      protocolVersion: "1.0" as const,
      pluginServerId: "com.example.extractor",
      displayName: "Example Extractor",
      auth: { type: "bearer" as const },
      matchers: [
        { hosts: ["resolver-beta.example"], hostPatterns: ["*resolver-beta*"] },
      ],
      features: { password: true, lazyNodes: true },
      extensions: {
        lynvo: {
          plugins: [
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

    const source = getMatchedPlugin(
      manifest,
      "https://new-resolver-beta-host.example/file"
    )

    expect(source?.displayName).toBe("Resolver Beta")
  })

  it("upgrades PNG source icons without inventing missing icon URLs", () => {
    const view = getWorkerManifestView(
      JSON.stringify({
        protocolVersion: "1.0",
        pluginServerId: "com.example.extractor",
        displayName: "Example Extractor",
        auth: { type: "bearer" },
        matchers: [{ hosts: ["example.com"] }],
        features: {},
        extensions: {
          lynvo: {
            plugins: [
              {
                id: "first-source",
                displayName: "First source",
                iconUrl: "http://localhost:8788/icons/sources/first-source.png",
              },
              { id: "second-source", displayName: "Second source" },
            ],
          },
        },
      })
    )

    expect(view.plugins.map((source) => source.iconUrl)).toEqual([
      "http://localhost:8788/icons/sources/first-source.webp",
      undefined,
    ])
  })

  it("resolves loopback source icons through the current LAN host", () => {
    const view = getWorkerManifestView(
      JSON.stringify({
        protocolVersion: "1.0",
        pluginServerId: "com.lynvo.plnkextractor",
        displayName: "PlnkExtractor",
        auth: { type: "bearer" },
        matchers: [{ hosts: ["example.com"] }],
        features: {},
        extensions: {
          lynvo: {
            plugins: [
              {
                id: "hubcloud",
                displayName: "HubCloud",
                iconUrl: "http://localhost:8788/icons/sources/hubcloud.webp",
              },
            ],
          },
        },
      }),
      "http://192.168.1.3:5173"
    )

    expect(view.plugins[0]?.iconUrl).toBe(
      "http://192.168.1.3:8788/icons/sources/hubcloud.webp"
    )
  })
})
