import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { HttpServerRequest } from "effect/unstable/http"
import { Api } from "../Api"
import { ExtractorService } from "../../services/ExtractorService"
import { AuthSessionService } from "../../services/AuthSessionService"
import { CloudflareEnv } from "../../services/CloudflareEnv"
import { RequestEventService } from "../../services/request-event-service"

const webRequestFromSource = (source: object) =>
  source instanceof Request
    ? Effect.succeed(source)
    : Effect.die(new Error("HTTP server request source is not a Web Request"))

const extractionKind = (
  kind: string | undefined
): "source" | "node" | undefined =>
  kind === "source" || kind === "node" ? kind : undefined

export const ExtractorHandlers = HttpApiBuilder.group(
  Api,
  "extractor",
  (handlers) =>
    handlers
      .handle("extract", ({ query }) =>
        Effect.gen(function* () {
          const extractor = yield* ExtractorService
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
              worker_id_requested: query.workerId,
              source_id_requested: query.pluginId,
            },
          })

          const result = yield* extractor.extract({
            url: query.url,
            requestId: requestEvent.requestId,
            workerId: query.workerId,
            pluginId: query.pluginId,
            kind: extractionKind(query.kind),
            userId,
            accessToken: auth.accessToken,
          })
          requestEvent.add({
            extraction: {
              input_kind: extractionKind(query.kind) ?? "source",
              target_host: new URL(query.url).hostname,
              worker_id_requested: query.workerId,
              source_id_requested: query.pluginId,
              worker_id: result.meta?.workerId,
              source_id: result.meta?.pluginId,
              link_count: result.links.length,
            },
          })
          return result
        })
      )
      .handle("getMetadata", ({ query }) =>
        Effect.gen(function* () {
          const extractor = yield* ExtractorService
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

          return yield* extractor.getMetadata({
            url: query.url,
            requestId: requestEvent.requestId,
            userId,
            accessToken: auth.accessToken,
            env,
          })
        })
      )
)
