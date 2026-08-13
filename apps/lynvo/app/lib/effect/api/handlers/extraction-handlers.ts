import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { HttpServerRequest } from "effect/unstable/http"
import { Api } from "../Api"
import { ExtractionService } from "../../services/extraction-service"
import { AuthSessionService } from "../../services/AuthSessionService"
import { CloudflareEnv } from "../../services/CloudflareEnv"
import { RequestEventService } from "../../services/request-event-service"

const webRequestFromSource = <Source>(source: Source) =>
  source instanceof Request
    ? Effect.succeed(source)
    : Effect.die(new Error("HTTP server request source is not a Web Request"))

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
          const authSession = yield* AuthSessionService
          const request = yield* HttpServerRequest.HttpServerRequest
          const webRequest = yield* webRequestFromSource(request.source)
          const auth = yield* authSession.getSession(webRequest)
          const userId = auth.user?.id

          requestEvent.add({
            operation: "link_extract",
            authenticated: Boolean(userId),
            user_id: userId,
            extraction: {
              input_kind: extractionKind(query.kind) ?? "source",
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
            accessToken: auth.accessToken,
          })
          requestEvent.add({
            extraction: {
              input_kind: extractionKind(query.kind) ?? "source",
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
          const authSession = yield* AuthSessionService
          const request = yield* HttpServerRequest.HttpServerRequest
          const webRequest = yield* webRequestFromSource(request.source)
          const auth = yield* authSession.getSession(webRequest)
          const userId = auth.user?.id

          const env = yield* CloudflareEnv

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
            accessToken: auth.accessToken,
            env,
          })
        })
      )
)
