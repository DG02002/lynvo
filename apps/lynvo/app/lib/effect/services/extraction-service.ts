import { Context, Effect, Layer } from "effect"
import { ConvexService } from "./ConvexService"
import { ConvexError, ExtractionError, ValidationError } from "../errors"
import {
  extractDirectMedia,
  getDirectMediaMetadata,
} from "./direct-media-adapter"
import { directMediaAdapter } from "../../plugins/direct-media-adapter"
import { getCustomPluginServerMetadata } from "./custom-plugin-server-adapter"
import type {
  ExtractionResult,
  ExtractOptions,
  ExtractionServiceShape,
  MetadataOptions,
  MetadataResult,
} from "./extraction-types"
import { PluginCredentialVault } from "./plugin-credential-vault"
import { CloudflareEnv } from "./CloudflareEnv"
import { getLynvoPluginServerMetadata } from "./lynvo-plugin-server-adapter"
import { prepareExtractionRouteInput } from "./extraction-route-input"
import { executeLynvoRoute } from "./lynvo-route-execution"
import { executeCustomRoute } from "./custom-route-execution"
import { loadAuthenticatedExtractionContext } from "./authenticated-extraction-context"
import { selectExtractionRoute } from "./extraction-route-selection"

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
          const route = yield* selectExtractionRoute(
            convex,
            environment,
            context.pluginServers,
            {
              targetUrl,
              accessToken: options.accessToken,
              requestId: options.requestId,
              pluginServerId: options.pluginServerId,
              pluginId: options.pluginId,
              extractionKind: options.kind ?? "source",
              inlineBasicAuth: routeInput.basicAuth,
            }
          )
          if (route.kind === "custom") {
            return yield* executeCustomRoute(
              convex,
              credentialVault,
              route.route,
              {
                targetUrl,
                userId: options.userId,
                accessToken: options.accessToken,
                serviceToken: context.serviceToken,
                requestId: options.requestId,
                kind: options.kind ?? "source",
                inlineBasicAuth: routeInput.basicAuth,
              }
            )
          }
          if (route.kind === "lynvo") {
            return yield* executeLynvoRoute(
              convex,
              credentialVault,
              environment,
              route.route,
              {
                targetUrl,
                userId: options.userId,
                accessToken: options.accessToken,
                serviceToken: context.serviceToken,
                requestId: options.requestId,
                kind: options.kind ?? "source",
                inlineBasicAuth: routeInput.basicAuth,
              }
            )
          }
        }

        return yield* extractDirectMedia(directMediaAdapter, targetUrl)
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
                new ConvexError({ message: error.message, cause: error })
            )
          )
          const route = yield* selectExtractionRoute(
            convex,
            environment,
            context.pluginServers,
            {
              targetUrl,
              accessToken: options.accessToken,
              requestId: options.requestId,
              extractionKind: "source",
              inlineBasicAuth: routeInput.basicAuth,
            }
          ).pipe(
            Effect.mapError((error) =>
              error._tag === "ExtractionError"
                ? new ConvexError({ message: error.message, cause: error })
                : error
            )
          )
          if (route.kind === "custom") {
            const metadata = yield* getCustomPluginServerMetadata(
              route.route.pluginServer,
              targetUrl,
              route.route.plugin?.id
            )
            if (metadata) {
              return metadata
            }
          }
          if (route.kind === "lynvo") {
            const metadata = getLynvoPluginServerMetadata(
              route.route.manifest,
              targetUrl,
              route.route.plugin.id
            )
            if (metadata) {
              return metadata
            }
          }
        }

        return yield* getDirectMediaMetadata(directMediaAdapter, {
          ...options,
          url: targetUrl,
        })
      })

      return ExtractionService.of({ extract, getMetadata })
    })
  )
}
