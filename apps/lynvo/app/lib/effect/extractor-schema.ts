export type {
  PluginServerManifest as WorkerManifest,
  PluginServerMatcher as WorkerMatcher,
  MediaNode as WorkerNode,
} from "@lynvo/plugin-server-protocol"
export {
  extractErrorSchema as WorkerErrorResponseSchema,
  extractSuccessSchema as WorkerExtractionResponseSchema,
  pluginServerManifestSchema as WorkerManifestSchema,
} from "@lynvo/plugin-server-protocol"
