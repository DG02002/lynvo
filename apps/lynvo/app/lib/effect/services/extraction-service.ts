import { Context, Effect, Layer } from "effect"
import { ConvexService } from "./ConvexService"
import { ConvexError, ExtractionError, ValidationError } from "../errors"
import { createDirectMediaModule } from "../../plugins/direct-media"
import { createOutboundHttpTransport } from "../../outbound-http"
import type {
  ExtractionResult,
  ExtractOptions,
  ExtractionServiceShape,
  MetadataOptions,
  MetadataResult,
} from "./extraction-types"
import { PluginCredentialVault } from "./plugin-credential-vault"
import { CloudflareEnv } from "./CloudflareEnv"
import { prepareExtractionRouteInput } from "./extraction-route-input"
import { loadAuthenticatedExtractionContext } from "./authenticated-extraction-context"
import {
  extractWithCustomPluginServer,
  getCustomRouteMetadata,
} from "./custom-extraction-adapter"
import {
  extractWithLynvoPluginServer,
  getLynvoRouteMetadata,
} from "./lynvo-extraction-adapter"
import { LYNVO_PLUGIN_SERVER_ID } from "../../constants"

export class ExtractionService extends Context.Service<
  ExtractionService,
  ExtractionServiceShape
>()("app/effect/services/extraction-service") {
  static readonly layer = Layer.effect(
    ExtractionService,
    Effect.gen(function* () {
      const convex = yield* ConvexService
      const credentialVault = yield* PluginCredentialVault
      const environment = yield* CloudflareEnv
      const directMedia = createDirectMediaModule(createOutboundHttpTransport())

      const extract = Effect.fn("ExtractionService.extract")(function* (
        options: ExtractOptions
      ): Effect.fn.Return<ExtractionResult, ExtractionError | ValidationError> {
        const routeInput = yield* prepareExtractionRouteInput(options.url)
        const targetUrl = routeInput.targetUrl
        if (options.userId && options.accessToken) {
          const context = yield* loadAuthenticatedExtractionContext(
            convex,
            environment,
            options.userId,
            options.accessToken
          ).pipe(
            Effect.mapError(
              (error) =>
                new ValidationError({
                  message: error.message,
                  details: error,
                })
            )
          )
          const routeOptions = {
            targetUrl,
            userId: options.userId,
            accessToken: options.accessToken,
            serviceToken: context.serviceToken,
            requestId: options.requestId,
            pluginServerId: options.pluginServerId,
            pluginId: options.pluginId,
            kind: options.kind ?? "source",
            inlineBasicAuth: routeInput.basicAuth,
          }
          const customResult = yield* extractWithCustomPluginServer(
            convex,
            credentialVault,
            context.pluginServers,
            routeOptions
          )
          if (customResult) {
            return customResult
          }
          if (
            options.pluginServerId &&
            options.pluginServerId !== LYNVO_PLUGIN_SERVER_ID
          ) {
            return yield* new ValidationError({
              message: "The saved Plugin Server is unavailable.",
            })
          }
          const lynvoResult = yield* extractWithLynvoPluginServer(
            convex,
            credentialVault,
            environment,
            routeOptions
          )
          if (lynvoResult) {
            return lynvoResult
          }
          if (options.pluginServerId === LYNVO_PLUGIN_SERVER_ID) {
            return yield* new ValidationError({
              message: "The saved Plugin Server is unavailable.",
            })
          }
        }

        const links = yield* Effect.tryPromise({
          try: () => directMedia.extract(targetUrl),
          catch: (cause) =>
            new ExtractionError({
              message: cause instanceof Error ? cause.message : String(cause),
              url: targetUrl,
            }),
        })
        return { links }
      })

      const getMetadata = Effect.fn("ExtractionService.getMetadata")(function* (
        options: MetadataOptions
      ): Effect.fn.Return<MetadataResult, ValidationError | ConvexError> {
        const routeInput = yield* prepareExtractionRouteInput(options.url)
        const targetUrl = routeInput.targetUrl

        if (options.userId && options.accessToken) {
          const context = yield* loadAuthenticatedExtractionContext(
            convex,
            environment,
            options.userId,
            options.accessToken
          ).pipe(
            Effect.mapError(
              (error) =>
                new ConvexError({
                  message: error.message,
                  cause: error,
                })
            )
          )
          const routeOptions = {
            targetUrl,
            accessToken: options.accessToken,
            requestId: options.requestId,
            kind: "source" as const,
            inlineBasicAuth: routeInput.basicAuth,
          }
          const customMetadata = yield* getCustomRouteMetadata(
            context.pluginServers,
            routeOptions
          ).pipe(
            Effect.mapError((error) =>
              error._tag === "ValidationError"
                ? error
                : new ConvexError({ message: error.message, cause: error })
            )
          )
          if (customMetadata) {
            return customMetadata
          }
          const lynvoMetadata = yield* getLynvoRouteMetadata(
            convex,
            environment,
            routeOptions
          ).pipe(
            Effect.mapError((error) =>
              error._tag === "ValidationError"
                ? error
                : new ConvexError({ message: error.message, cause: error })
            )
          )
          if (lynvoMetadata) {
            return lynvoMetadata
          }
        }

        return yield* Effect.tryPromise({
          try: () => directMedia.getMetadata(targetUrl),
          catch: (cause) =>
            new ConvexError({ message: "Metadata fetch failed", cause }),
        })
      })

      return ExtractionService.of({ extract, getMetadata })
    })
  )
}
