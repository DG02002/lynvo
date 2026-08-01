import type { ExtractSuccessResponse } from "@dg02002/lynvo-plugin-server-protocol"

export const extractExampleSource = (
  targetUrl: string,
  pluginServerId: string
): ExtractSuccessResponse => ({
  plugin: {
    pluginServerId,
    displayName: "__PROJECT_DISPLAY_NAME__",
    pluginId: "example-source",
    pluginName: "Example Source",
  },
  nodes: [
    {
      kind: "playable",
      label: "Example playable item",
      url: targetUrl,
    },
  ],
  extensions: {},
})
