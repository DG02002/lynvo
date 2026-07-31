import { Context, Effect, Layer } from "effect"
import { ConvexService } from "./ConvexService"
import { api } from "../../../../convex/_generated/api"
import { ConvexError, ExtractionError, ValidationError } from "../errors"
import {
  extractDirectMedia,
  getDirectMediaMetadata,
} from "./direct-media-adapter"
import { directMediaAdapter } from "../../plugins/direct-media-adapter"
import {
  extractFromCustomPluginServer,
  getCustomPluginServerMetadata,
} from "./custom-plugin-server-adapter"
import type {
  ExtractionResult,
  ExtractOptions,
  ExtractionServiceShape,
  MetadataOptions,
  MetadataResult,
} from "./extraction-types"
import { PluginCredentialVault } from "./plugin-credential-vault"
import { CloudflareEnv } from "./CloudflareEnv"
import {
  extractFromLynvoPluginServer,
  getLynvoPluginServerMetadata,
} from "./lynvo-plugin-server-adapter"
import { LYNVO_PLUGIN_SERVER_ID } from "../../constants"
import { signCredentialReadToken } from "../../../lib/auth-gateway"
import { CREDENTIAL_READ_TOKEN_TTL_MS } from "../../../../convex/constants"
import { decryptCustomPluginServers } from "./custom-plugin-server-credentials"
import { prepareExtractionRouteInput } from "./extraction-route-input"
import { resolvePluginCredential } from "./plugin-credential-resolution"
import { selectLynvoRoute } from "./lynvo-route-selection"
import { selectCustomRoute } from "./custom-route-selection"

const getMeteredPluginId = (pluginId: string) => {
  if (
    pluginId === "bhadoo-google-drive-index" ||
    pluginId === "google-drive-public-files" ||
    pluginId === "onedrive-index" ||
    pluginId === "direct"
  ) {
    return pluginId
  }
  return undefined
}

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
          const serviceToken = yield* Effect.promise(() =>
            signCredentialReadToken(
              environment.AUTH_GATEWAY_SECRET,
              Date.now() + CREDENTIAL_READ_TOKEN_TTL_MS
            )
          )
          const storedPluginServers = yield* convex
            .query(
              api.userPluginServers.listForService,
              { serviceToken },
              { accessToken: options.accessToken }
            )
            .pipe(
              Effect.mapError(
                (error) =>
                  new ValidationError({
                    message: error.message,
                    details: error,
                  })
              )
            )
          const pluginServers = yield* decryptCustomPluginServers(
            environment,
            options.userId,
            storedPluginServers
          ).pipe(
            Effect.mapError(
              (error) =>
                new ValidationError({
                  message: error.message,
                  details: error,
                })
            )
          )
          const customRoute = yield* selectCustomRoute(pluginServers, {
            targetUrl,
            requestId: options.requestId,
            pluginServerId: options.pluginServerId,
            pluginId: options.pluginId,
            kind: options.kind ?? "source",
            inlineBasicAuth: routeInput.basicAuth,
          })
          if (customRoute) {
            const pluginServer = customRoute.pluginServer
            const source = customRoute.plugin
            const credentials = source
              ? yield* resolvePluginCredential(convex, credentialVault, {
                  targetUrl,
                  userId: options.userId,
                  accessToken: options.accessToken,
                  serviceToken,
                  pluginServerId: pluginServer._id,
                  plugin: source,
                  inlineBasicAuth: routeInput.basicAuth,
                })
              : {}
            return yield* extractFromCustomPluginServer(
              pluginServer,
              targetUrl,
              options.kind ?? "source",
              { pluginId: source?.id, ...credentials },
              options.requestId
            )
          }
          if (
            options.pluginServerId &&
            options.pluginServerId !== LYNVO_PLUGIN_SERVER_ID
          ) {
            return yield* new ValidationError({
              message: "The saved Plugin Server is unavailable.",
            })
          }

          const lynvoRoute = yield* selectLynvoRoute(convex, environment, {
            targetUrl,
            accessToken: options.accessToken,
            requestId: options.requestId,
            pluginId: options.pluginId,
            kind: options.kind ?? "source",
            inlineBasicAuth: routeInput.basicAuth,
          })
          if (
            options.pluginServerId === LYNVO_PLUGIN_SERVER_ID &&
            !lynvoRoute
          ) {
            return yield* new ValidationError({
              message: "The saved Plugin Server is unavailable.",
            })
          }
          if (lynvoRoute) {
            const source = lynvoRoute.plugin
            const credentials = yield* resolvePluginCredential(
              convex,
              credentialVault,
              {
                targetUrl,
                userId: options.userId,
                accessToken: options.accessToken,
                serviceToken,
                pluginServerId: LYNVO_PLUGIN_SERVER_ID,
                plugin: source,
                inlineBasicAuth: routeInput.basicAuth,
              }
            )
            const meteredSourceId = getMeteredPluginId(source.id)
            if (meteredSourceId) {
              yield* convex
                .mutation(
                  api.usage.consumeLynvoPlugin,
                  { pluginId: meteredSourceId },
                  { accessToken: options.accessToken }
                )
                .pipe(
                  Effect.mapError(
                    (error) =>
                      new ExtractionError({
                        message: error.message,
                        url: targetUrl,
                      })
                  )
                )
            }
            return yield* extractFromLynvoPluginServer(
              environment,
              targetUrl,
              options.kind ?? "source",
              { pluginId: source.id, ...credentials },
              options.requestId
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
          const serviceToken = yield* Effect.promise(() =>
            signCredentialReadToken(
              environment.AUTH_GATEWAY_SECRET,
              Date.now() + CREDENTIAL_READ_TOKEN_TTL_MS
            )
          )
          const storedPluginServers = yield* convex.query(
            api.userPluginServers.listForService,
            { serviceToken },
            { accessToken: options.accessToken }
          )
          const pluginServers = yield* decryptCustomPluginServers(
            environment,
            options.userId,
            storedPluginServers
          ).pipe(
            Effect.mapError(
              (error) =>
                new ConvexError({ message: error.message, cause: error })
            )
          )
          const customRoute = yield* selectCustomRoute(pluginServers, {
            targetUrl,
            requestId: options.requestId,
            kind: "source",
            inlineBasicAuth: routeInput.basicAuth,
          })
          if (customRoute) {
            const metadata = yield* getCustomPluginServerMetadata(
              customRoute.pluginServer,
              targetUrl,
              customRoute.plugin?.id
            )
            if (metadata) {
              return metadata
            }
          }

          const lynvoRoute = yield* selectLynvoRoute(convex, environment, {
            targetUrl,
            accessToken: options.accessToken,
            requestId: options.requestId,
            kind: "source",
            inlineBasicAuth: routeInput.basicAuth,
          })
          if (lynvoRoute) {
            const metadata = getLynvoPluginServerMetadata(
              lynvoRoute.manifest,
              targetUrl,
              lynvoRoute.plugin.id
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
