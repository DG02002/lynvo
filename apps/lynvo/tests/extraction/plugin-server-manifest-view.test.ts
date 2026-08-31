import { describe, expect, it } from "vitest"
import { getMatchedPlugin } from "@dg02002/lynvo-plugin-server-protocol"
import { getPluginServerManifestView } from "~/features/site/settings/plugin-server-manifest"

describe("getPluginServerManifestView", () => {
  it("exposes Custom Plugin Server icons from protocol manifests", () => {
    const view = getPluginServerManifestView(
      JSON.stringify({
        protocolVersion: "1.0",
        pluginServerId: "dev.example.plugin-server",
        displayName: "Example Plugin Server",
        iconUrl: "https://plugin-server.example/icon.webp",
        auth: { type: "bearer" },
        usage: { endpoint: "/usage" },
        matchers: [{ hosts: ["example.com"], pathPatterns: ["/**"] }],
        features: { password: true, lazyNodes: true },
        extensions: {
          lynvo: {
            plugins: [
              {
                id: "example-source",
                displayName: "Example Source",
                status: "active",
                version: "1.0.0",
                hosts: ["example.com"],
              },
            ],
          },
        },
      })
    )

    expect(view.name).toBe("Example Plugin Server")
    expect(view.icon).toBe("https://plugin-server.example/icon.webp")
    expect(view.hosts).toBe("example.com")
  })

  it("does not display manifests that fail the current contract", () => {
    const view = getPluginServerManifestView(
      JSON.stringify({
        protocolVersion: "1.0",
        pluginServerId: "dev.example.incomplete-plugin-server",
        displayName: "Incomplete Plugin Server",
        auth: { type: "bearer" },
        matchers: [{ hosts: ["incomplete.example"] }],
        features: {},
        extensions: {
          lynvo: {
            plugins: [
              {
                id: "incomplete-source",
                displayName: "Incomplete Source",
                hosts: ["incomplete.example"],
              },
            ],
          },
        },
      })
    )

    expect(view).toEqual({
      name: "Unknown",
      icon: null,
      hosts: "None",
      plugins: [],
    })
  })

  it("exposes Plugin icons from Lynvo manifest extensions", () => {
    const view = getPluginServerManifestView(
      JSON.stringify({
        protocolVersion: "1.0",
        pluginServerId: "dev.example.plugin-server",
        displayName: "Example Plugin Server",
        auth: { type: "bearer" },
        usage: { endpoint: "/usage" },
        matchers: [{ hosts: ["resolver-beta.example"], pathPatterns: ["/**"] }],
        features: { password: true, lazyNodes: true },
        extensions: {
          lynvo: {
            plugins: [
              {
                id: "resolver-beta",
                displayName: "Resolver Beta",
                iconUrl: "https://icons.example/resolver-beta.webp",
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
        iconUrl: "https://icons.example/resolver-beta.webp",
        status: "maintenance",
        version: "1.2.3",
        hosts: ["resolver-beta.example"],
      },
    ])
  })

  it("matches Plugin metadata using Source matchers", () => {
    const manifest = {
      protocolVersion: "1.0" as const,
      pluginServerId: "dev.example.plugin-server",
      displayName: "Example Plugin Server",
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
    const view = getPluginServerManifestView(
      JSON.stringify({
        protocolVersion: "1.0",
        pluginServerId: "dev.example.plugin-server",
        displayName: "Example Plugin Server",
        auth: { type: "bearer" },
        usage: { endpoint: "/usage" },
        matchers: [{ hosts: ["example.com"] }],
        features: {},
        extensions: {
          lynvo: {
            plugins: [
              {
                id: "first-source",
                displayName: "First source",
                iconUrl:
                  "http://localhost:8788/icons/sources/first-source.webp",
                status: "active",
                version: "1.0.0",
                hosts: ["example.com"],
              },
              {
                id: "second-source",
                displayName: "Second source",
                status: "active",
                version: "1.0.0",
                hosts: ["example.com"],
              },
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
    const view = getPluginServerManifestView(
      JSON.stringify({
        protocolVersion: "1.0",
        pluginServerId: "dev.example.custom-plugin-server",
        displayName: "Example Custom Plugin Server",
        auth: { type: "bearer" },
        usage: { endpoint: "/usage" },
        matchers: [{ hosts: ["example.com"] }],
        features: {},
        extensions: {
          lynvo: {
            plugins: [
              {
                id: "example-drive",
                displayName: "Example Drive",
                iconUrl:
                  "http://localhost:8788/icons/sources/example-drive.webp",
                status: "active",
                version: "1.0.0",
                hosts: ["example.com"],
              },
            ],
          },
        },
      }),
      "http://192.168.1.3:5173"
    )

    expect(view.plugins[0]?.iconUrl).toBe(
      "http://192.168.1.3:8788/icons/sources/example-drive.webp"
    )
  })
})
