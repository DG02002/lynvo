import type { PluginServerManifest } from "@dg02002/lynvo-plugin-server-protocol"
import { findLynvoPlugin } from "~/lib/effect/services/lynvo-plugin-server-adapter"

const manifest: PluginServerManifest = {
  protocolVersion: "1.0",
  pluginServerId: "dev.lynvo.plugin-server",
  displayName: "Lynvo Plugin Server",
  auth: { type: "bearer" },
  usage: { endpoint: "/usage" },
  matchers: [{ hosts: ["drive.google.com"] }],
  features: { password: false, lazyNodes: false },
  extensions: {
    lynvo: {
      plugins: [
        {
          id: "google-drive",
          displayName: "Google Drive",
          matchStrategy: "static",
          hosts: ["drive.google.com"],
          matchers: [{ hosts: ["drive.google.com"] }],
        },
        {
          id: "direct-media",
          displayName: "Direct Media",
          matchStrategy: "probe",
          hosts: [],
        },
      ],
    },
  },
}

describe("Lynvo Plugin Server routing", () => {
  it("selects static matches before the fallback probe", () => {
    expect(
      findLynvoPlugin({
        manifest,
        targetUrl: "https://drive.google.com/file/d/example",
      })?.id
    ).toBe("google-drive")
    expect(
      findLynvoPlugin({
        manifest,
        targetUrl: "https://media.example/video.mp4",
      })?.id
    ).toBe("direct-media")
  })

  it("preserves explicit Plugin selection ahead of automatic matching", () => {
    expect(
      findLynvoPlugin({
        manifest,
        targetUrl: "https://drive.google.com/file/d/example",
        pluginId: "direct-media",
      })?.id
    ).toBe("direct-media")
  })
})
