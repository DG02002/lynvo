import { Context, Effect, Layer } from "effect"
import { ConvexService } from "./ConvexService"
import { api } from "../../../../convex/_generated/api"
import { isSafeUrl } from "../../../lib/ssrf"
import { ConvexError, ExtractionError, ValidationError } from "../errors"
import {
  extractDirectMedia,
  getDirectMediaMetadata,
} from "./direct-media-adapter"
import { directMediaAdapter } from "../../plugins/direct-media-adapter"
import {
  discoverCustomPlugin,
  extractFromCustomPluginServer,
  getCustomPlugin,
  getCustomPluginServerMetadata,
  selectCustomPluginServer,
} from "./custom-plugin-server-adapter"
import type {
  ExtractionResult,
  ExtractOptions,
  ExtractionServiceShape,
  MetadataOptions,
  MetadataResult,
} from "./extraction-types"
import { PluginCredentialVault } from "./plugin-credential-vault"
import { parseHttpBasicCredential } from "../../plugins/http-basic-credential"
import { CloudflareEnv } from "./CloudflareEnv"
import {
  discoverLynvoPlugin,
  extractFromLynvoPluginServer,
  findLynvoPlugin,
  getLynvoPluginServerManifest,
  getLynvoPluginServerMetadata,
} from "./lynvo-plugin-server-adapter"
import { LYNVO_PLUGIN_SERVER_ID } from "../../constants"
import { signCredentialReadToken } from "../../../lib/auth-gateway"
import { CREDENTIAL_READ_TOKEN_TTL_MS } from "../../../../convex/constants"
import { extractHttpBasicCredential } from "../../plugins/http-basic-credential"
import { decryptCustomPluginServers } from "./custom-plugin-server-credentials"

const getHostname = (value: string): string => new URL(value).hostname

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
        const extractedAuth = extractHttpBasicCredential(options.url)
        const targetUrl = extractedAuth.url
        if (!isSafeUrl(targetUrl)) {
          return yield* new ValidationError({
            message: "Invalid or unsafe URL",
          })
        }
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
          const pluginServer = yield* selectCustomPluginServer(
            pluginServers,
            targetUrl,
            options.pluginServerId
          )
          if (pluginServer) {
            let source = yield* getCustomPlugin(
              pluginServer,
              targetUrl,
              options.pluginId
            )
            const discoveryAttempt =
              (options.kind ?? "source") === "source"
                ? yield* discoverCustomPlugin(
                    pluginServer,
                    targetUrl,
                    extractedAuth.basicAuth,
                    options.requestId
                  ).pipe(Effect.option)
                : undefined
            const discovery =
              discoveryAttempt?._tag === "Some"
                ? discoveryAttempt.value
                : undefined
            if (discovery?.matched) {
              const discoveredSource = yield* getCustomPlugin(
                pluginServer,
                targetUrl,
                discovery.pluginId
              )
              if (discoveredSource) {
                source = discoveredSource
              }
            }
            let password: string | undefined
            let basicAuth =
              source?.credential?.kind === "http-basic"
                ? extractedAuth.basicAuth
                : undefined
            if (source?.credential && !basicAuth) {
              const domain = getHostname(targetUrl)
              const encryptedCredential = yield* convex
                .query(
                  api.pluginDomains.getCredentialByDomainForService,
                  { domain, pluginServerId: pluginServer._id, serviceToken },
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
              if (encryptedCredential?.pluginId === source.id) {
                const credential = yield* credentialVault
                  .decrypt(encryptedCredential, {
                    userId: options.userId,
                    pluginServerId: pluginServer._id,
                    pluginId: source.id,
                    domain,
                  })
                  .pipe(
                    Effect.mapError(
                      (error) =>
                        new ExtractionError({
                          message: error.message,
                          url: targetUrl,
                        })
                    )
                  )
                if (source.credential.kind === "domain-password") {
                  password = credential
                } else {
                  basicAuth = parseHttpBasicCredential(credential)
                }
              }
            }
            return yield* extractFromCustomPluginServer(
              pluginServer,
              targetUrl,
              options.kind ?? "source",
              { pluginId: source?.id, password, basicAuth },
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

          const officialManifest = yield* getLynvoPluginServerManifest(
            environment,
            options.requestId
          ).pipe(Effect.option)
          const manifest =
            officialManifest._tag === "Some"
              ? officialManifest.value
              : undefined
          const configuredDomain = yield* convex
            .query(
              api.pluginDomains.getByDomain,
              {
                domain: getHostname(targetUrl),
                pluginServerId: LYNVO_PLUGIN_SERVER_ID,
              },
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
          let source = manifest
            ? findLynvoPlugin(
                manifest,
                targetUrl,
                options.pluginId ?? configuredDomain?.pluginId
              )
            : undefined
          if (
            !source &&
            manifest?.features.discovery &&
            (options.kind ?? "source") === "source"
          ) {
            const discoveryAttempt = yield* discoverLynvoPlugin(
              environment,
              targetUrl,
              extractedAuth.basicAuth,
              options.requestId
            ).pipe(Effect.option)
            const discovery =
              discoveryAttempt._tag === "Some"
                ? discoveryAttempt.value
                : undefined
            if (discovery?.matched) {
              source = findLynvoPlugin(manifest, targetUrl, discovery.pluginId)
            }
          }
          if (options.pluginServerId === LYNVO_PLUGIN_SERVER_ID && !source) {
            return yield* new ValidationError({
              message: "The saved Plugin Server is unavailable.",
            })
          }
          if (source) {
            let password: string | undefined
            let basicAuth: { username: string; password: string } | undefined =
              source.credential?.kind === "http-basic"
                ? extractedAuth.basicAuth
                : undefined
            if (source.credential) {
              const domain = getHostname(targetUrl)
              const encryptedCredential = yield* convex
                .query(
                  api.pluginDomains.getCredentialByDomainForService,
                  {
                    domain,
                    pluginServerId: LYNVO_PLUGIN_SERVER_ID,
                    serviceToken,
                  },
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
              if (!basicAuth && encryptedCredential?.pluginId === source.id) {
                const credential = yield* credentialVault
                  .decrypt(encryptedCredential, {
                    userId: options.userId,
                    pluginServerId: LYNVO_PLUGIN_SERVER_ID,
                    pluginId: source.id,
                    domain,
                  })
                  .pipe(
                    Effect.mapError(
                      (error) =>
                        new ExtractionError({
                          message: error.message,
                          url: targetUrl,
                        })
                    )
                  )
                if (source.credential.kind === "domain-password") {
                  password = credential
                } else {
                  basicAuth = parseHttpBasicCredential(credential)
                }
              }
            }
            const meteredSourceId = getMeteredPluginId(source.id)
            if (meteredSourceId) {
              yield* convex
                .mutation(
                  api.usage.consumeOfficialPlugin,
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
              { pluginId: source.id, password, basicAuth },
              options.requestId
            )
          }
        }

        return yield* extractDirectMedia(directMediaAdapter, targetUrl)
      })

      const getMetadata = Effect.fn("ExtractionService.getMetadata")(function* (
        options: MetadataOptions
      ): Effect.fn.Return<MetadataResult, ValidationError | ConvexError> {
        if (!isSafeUrl(options.url)) {
          return yield* new ValidationError({
            message: "Invalid or unsafe URL",
          })
        }

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
          const pluginServer = yield* selectCustomPluginServer(
            pluginServers,
            options.url
          )
          if (pluginServer) {
            const metadata = yield* getCustomPluginServerMetadata(
              pluginServer,
              options.url
            )
            if (metadata) {
              return metadata
            }
          }

          const officialManifest = yield* getLynvoPluginServerManifest(
            environment
          ).pipe(Effect.option)
          if (officialManifest._tag === "Some") {
            const extractedAuth = extractHttpBasicCredential(options.url)
            const configuredDomain = yield* convex.query(
              api.pluginDomains.getByDomain,
              {
                domain: getHostname(extractedAuth.url),
                pluginServerId: LYNVO_PLUGIN_SERVER_ID,
              },
              { accessToken: options.accessToken }
            )
            let metadata = getLynvoPluginServerMetadata(
              officialManifest.value,
              extractedAuth.url,
              configuredDomain?.pluginId
            )
            if (!metadata && officialManifest.value.features.discovery) {
              const discovery = yield* discoverLynvoPlugin(
                environment,
                extractedAuth.url,
                extractedAuth.basicAuth,
                options.requestId
              ).pipe(Effect.option)
              if (discovery._tag === "Some" && discovery.value.matched) {
                metadata = getLynvoPluginServerMetadata(
                  officialManifest.value,
                  extractedAuth.url,
                  discovery.value.pluginId
                )
              }
            }
            if (metadata) {
              return metadata
            }
          }
        }

        return yield* getDirectMediaMetadata(directMediaAdapter, options)
      })

      return ExtractionService.of({ extract, getMetadata })
    })
  )
}
