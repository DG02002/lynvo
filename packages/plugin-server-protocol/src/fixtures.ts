import type {
  ExtractProtocolError,
  ExtractSuccessResponse,
  PluginServerManifest,
  UsageResponse,
} from "./models"

export const validPluginServerManifestFixture: PluginServerManifest = {
  protocolVersion: "1.0",
  pluginServerId: "dev.lynvo.example-plugin-server",
  displayName: "Example Plugin Server",
  auth: { type: "bearer" },
  usage: { endpoint: "/usage" },
  matchers: [{ hosts: ["media.example.com"] }],
  features: { password: false, lazyNodes: false },
  extensions: {
    lynvo: {
      plugins: [
        {
          id: "example-media",
          displayName: "Example Media",
          status: "active",
          version: "1.0.0",
          hosts: ["media.example.com"],
        },
      ],
    },
  },
}

export const validUsageResponseFixture: UsageResponse = {
  metrics: [
    {
      id: "example-operations-daily",
      label: "Example operations",
      used: 0,
      limit: 1_000,
      unit: "operations",
      period: "daily",
      resetsAt: "2030-01-02T00:00:00.000Z",
      pluginId: "example-media",
    },
  ],
}

export const validExtractSuccessFixture: ExtractSuccessResponse = {
  plugin: {
    pluginServerId: validPluginServerManifestFixture.pluginServerId,
    displayName: validPluginServerManifestFixture.displayName,
    pluginId: "example-media",
    pluginName: "Example Media",
  },
  nodes: [
    {
      kind: "playable",
      label: "Example video",
      url: "https://media.example.com/video.mp4",
    },
  ],
  extensions: {},
}

export const validExtractErrorFixture: ExtractProtocolError = {
  ok: false,
  error: { code: "UNSUPPORTED_URL", message: "URL is not supported." },
  extensions: {},
}
