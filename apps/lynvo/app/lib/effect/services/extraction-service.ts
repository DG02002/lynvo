import { Context, Effect, Layer } from "effect"
import { isLynvoPluginServerId } from "~shared/constants"

import {
  BackendError,
  ValidationError,
  type ExtractionError,
  type UsageLimitError,
} from "../errors"
import { loadRegisteredPluginServers } from "./authenticated-extraction-context"
import { CloudflareEnv } from "./cloudflare-env"
import {
  extractWithCustomPluginServer,
  getCustomRouteMetadata,
} from "./custom-extraction-adapter"
import { prepareExtractionRouteInput } from "./extraction-route-input"
import type {
  ExtractionResult,
  ExtractOptions,
  ExtractionServiceContract,
  MetadataOptions,
  MetadataResult,
} from "./extraction-types"
import {
  extractWithLynvoPluginServer,
  getLynvoRouteMetadata,
} from "./lynvo-extraction-adapter"
import {
  getLynvoPluginServerManifest,
  getLynvoPluginServerMetadata,
} from "./lynvo-plugin-server-adapter"
import { PluginCredentialVault } from "./plugin-credential-vault"

export class ExtractionService extends Context.Service<
  ExtractionService,
  ExtractionServiceContract
>()("app/effect/services/extraction-service") {
  static readonly layer = Layer.effect(
    ExtractionService,
    Effect.gen(function* () {
      const credentialVault = yield* PluginCredentialVault
      const environment = yield* CloudflareEnv

      const extract = Effect.fn("ExtractionService.extract")(function* (
        options: ExtractOptions
      ): Effect.fn.Return<
        ExtractionResult,
        ExtractionError | UsageLimitError | ValidationError
      > {
        const routeInput = yield* prepareExtractionRouteInput(options.url)
        const { targetUrl } = routeInput
        if (options.userId) {
          const context = yield* loadRegisteredPluginServers(
            environment,
            options.userId
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
            environment,
            targetUrl,
            userId: options.userId,
            requestId: options.requestId,
            pluginServerId: options.pluginServerId,
            pluginId: options.pluginId,
            kind: options.kind ?? "source",
            inlineBasicAuth: options.inlineBasicAuth ?? routeInput.basicAuth,
            freezeUsage: options.freezeUsage ?? false,
          }
          const customResult = yield* extractWithCustomPluginServer(
            credentialVault,
            context.pluginServers,
            routeOptions
          )
          if (customResult) {
            return customResult
          }
          if (
            options.pluginServerId &&
            !isLynvoPluginServerId(options.pluginServerId)
          ) {
            return yield* new ValidationError({
              message: "The saved Plugin Server is unavailable.",
            })
          }
          const lynvoResult = yield* extractWithLynvoPluginServer(
            credentialVault,
            routeOptions
          )
          if (lynvoResult) {
            return lynvoResult
          }
          if (isLynvoPluginServerId(options.pluginServerId)) {
            return yield* new ValidationError({
              message: "The saved Plugin Server is unavailable.",
            })
          }
        }

        return yield* new ValidationError({
          message: "Sign in to extract links with the Lynvo Plugin Server.",
        })
      })

      const getMetadata = Effect.fn("ExtractionService.getMetadata")(function* (
        options: MetadataOptions
      ): Effect.fn.Return<MetadataResult, ValidationError | BackendError> {
        const routeInput = yield* prepareExtractionRouteInput(options.url)
        const { targetUrl } = routeInput

        if (options.userId) {
          const context = yield* loadRegisteredPluginServers(
            options.env,
            options.userId
          ).pipe(
            Effect.mapError(
              (error) =>
                new BackendError({
                  message: error.message,
                  cause: error,
                })
            )
          )
          const routeOptions = {
            environment: options.env,
            targetUrl,
            userId: options.userId,
            requestId: options.requestId,
            pluginServerId: options.pluginServerId,
            pluginId: options.pluginId,
            kind: "source" as const,
            inlineBasicAuth: routeInput.basicAuth,
            freezeUsage: false,
          }
          const customMetadata = yield* getCustomRouteMetadata(
            context.pluginServers,
            routeOptions
          ).pipe(
            Effect.mapError((error) =>
              error._tag === "ValidationError"
                ? error
                : new BackendError({ message: error.message, cause: error })
            )
          )
          if (customMetadata) {
            return customMetadata
          }
          if (
            options.pluginServerId &&
            !isLynvoPluginServerId(options.pluginServerId)
          ) {
            return yield* new ValidationError({
              message: "The saved Plugin Server is unavailable.",
            })
          }
          const lynvoMetadata = yield* getLynvoRouteMetadata(routeOptions).pipe(
            Effect.mapError((error) =>
              error._tag === "ValidationError"
                ? error
                : new BackendError({ message: error.message, cause: error })
            )
          )
          if (lynvoMetadata) {
            return lynvoMetadata
          }
        }

        const manifest = yield* getLynvoPluginServerManifest(
          options.env,
          options.requestId
        ).pipe(
          Effect.mapError(
            (error) =>
              new BackendError({ message: error.message, cause: error })
          )
        )
        const metadata = getLynvoPluginServerMetadata(manifest, targetUrl)
        return metadata
          ? metadata
          : yield* new BackendError({
              message: "No Plugin is available for this URL.",
            })
      })

      return ExtractionService.of({ extract, getMetadata })
    })
  )
}
