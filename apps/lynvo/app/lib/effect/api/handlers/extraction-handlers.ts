import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { HttpServerRequest } from "effect/unstable/http"
import { Api } from "../api"
import { ExtractionService } from "../../services/extraction-service"
import { CloudflareEnv } from "../../services/cloudflare-env"
import { RequestEventService } from "../../services/request-event-service"
import {
  resolveOptionalSession,
  webRequestFromSource,
} from "../../session-context"
import { isDevelopmentFreezeUsageEnabled } from "../../../development-settings"

const extractionKind = (
  kind: string | undefined
): "source" | "node" | undefined =>
  kind === "source" || kind === "node" ? kind : undefined

export const ExtractionHandlers = HttpApiBuilder.group(
  Api,
  "extraction",
  (handlers) =>
    handlers
      .handle("extract", ({ query }) =>
        Effect.gen(function* () {
          const extraction = yield* ExtractionService
          const requestEvent = yield* RequestEventService
          const environment = yield* CloudflareEnv
          const request = yield* HttpServerRequest.HttpServerRequest
          const webRequest = yield* webRequestFromSource(request.source)
          const session = yield* resolveOptionalSession(webRequest, environment)
          const userId = session?.userId
          const inputKind = extractionKind(query.kind) ?? "source"
          const operationId = `${requestEvent.requestId}:${inputKind}`

          requestEvent.add({
            operation: "link_extract",
            operation_id: operationId,
            authenticated: Boolean(userId),
            user_id: userId,
            extraction: {
              input_kind: inputKind,
              target_host: new URL(query.url).hostname,
              plugin_server_id_requested: query.pluginServerId,
              source_id_requested: query.pluginId,
            },
          })

          const result = yield* extraction.extract({
            url: query.url,
            requestId: requestEvent.requestId,
            pluginServerId: query.pluginServerId,
            pluginId: query.pluginId,
            kind: extractionKind(query.kind),
            userId,
            freezeUsage: isDevelopmentFreezeUsageEnabled(webRequest),
          })
          requestEvent.add({
            extraction: {
              input_kind: inputKind,
              target_host: new URL(query.url).hostname,
              plugin_server_id_requested: query.pluginServerId,
              source_id_requested: query.pluginId,
              plugin_server_id: result.meta?.pluginServerId,
              source_id: result.meta?.pluginId,
              link_count: result.links.length,
            },
          })
          return result
        })
      )
      .handle("getMetadata", ({ query }) =>
        Effect.gen(function* () {
          const extraction = yield* ExtractionService
          const requestEvent = yield* RequestEventService
          const environment = yield* CloudflareEnv
          const request = yield* HttpServerRequest.HttpServerRequest
          const webRequest = yield* webRequestFromSource(request.source)
          const session = yield* resolveOptionalSession(webRequest, environment)
          const userId = session?.userId

          requestEvent.add({
            operation: "link_metadata_read",
            authenticated: Boolean(userId),
            user_id: userId,
            target_host: new URL(query.url).hostname,
          })

          return yield* extraction.getMetadata({
            url: query.url,
            requestId: requestEvent.requestId,
            userId,
            env: environment,
            pluginServerId: query.pluginServerId,
            pluginId: query.pluginId,
          })
        })
      )
)
