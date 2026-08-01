import type { ExtractSuccessResponse } from "@dg02002/lynvo-plugin-server-protocol"
import { Effect } from "effect"
import { ExtractionError } from "../errors"
import {
  PluginServerClient,
  PluginServerClientError,
  type PluginServerRequestOptions,
} from "../../extraction/plugin-server-client"

export const createPluginServerExtractionError = (
  cause: unknown,
  url: string
): ExtractionError =>
  new ExtractionError({
    message:
      cause instanceof PluginServerClientError
        ? cause.code
        : "TEMPORARY_FAILURE",
    url,
  })

export const requestPluginServer = <Value>(
  operation: () => Promise<Value>,
  url: string
) =>
  Effect.tryPromise({
    try: operation,
    catch: (cause) => createPluginServerExtractionError(cause, url),
  })

export const extractPluginServerResponse = (
  client: PluginServerClient,
  targetUrl: string,
  kind: "source" | "node",
  options: PluginServerRequestOptions
): Promise<ExtractSuccessResponse> =>
  kind === "node"
    ? client.extractNode(targetUrl, options)
    : client.extractSource(targetUrl, options)
