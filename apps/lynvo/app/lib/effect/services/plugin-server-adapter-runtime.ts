import type { ExtractSuccessResponse } from "@dg02002/lynvo-plugin-server-protocol"
import { Effect } from "effect"
import { ExtractionError } from "../errors"
import {
  PluginServerClientError,
  type PluginServerClient,
  type PluginServerRequestOptions,
} from "../../extraction/plugin-server-client"

export const createPluginServerExtractionError = (
  cause: unknown,
  url: string
): ExtractionError => {
  if (cause instanceof PluginServerClientError) {
    return new ExtractionError({
      message: cause.code,
      url,
      detail: cause.message,
      status: cause.status,
    })
  }
  return new ExtractionError({
    message: "TEMPORARY_FAILURE",
    url,
  })
}

export const requestPluginServer = <Value>(
  operation: () => Promise<Value>,
  url: string
) =>
  Effect.tryPromise({
    try: operation,
    catch: (cause) => createPluginServerExtractionError(cause, url),
  })

interface ExtractPluginServerResponseInput {
  readonly client: PluginServerClient
  readonly targetUrl: string
  readonly kind: "source" | "node"
  readonly requestOptions: PluginServerRequestOptions
}

export const extractPluginServerResponse = ({
  client,
  targetUrl,
  kind,
  requestOptions,
}: ExtractPluginServerResponseInput): Promise<ExtractSuccessResponse> =>
  kind === "node"
    ? client.extractNode(targetUrl, requestOptions)
    : client.extractSource(targetUrl, requestOptions)
