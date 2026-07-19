import { Context, Effect, Layer } from "effect"
import { getMatchedExtractorSource } from "@lynvo/extractor-protocol"
import { ConvexService } from "./ConvexService"
import { api } from "../../../../convex/_generated/api"
import { isSafeUrl } from "../../../lib/ssrf"
import {
  ConvexError,
  ExtractionError,
  UnauthorizedError,
  ValidationError,
} from "../errors"
import {
  extractFromPlugin,
  getPluginMetadata,
  resolvePlugin,
  resolvePluginById,
} from "./PluginExtractorAdapter"
import {
  extractFromWorker,
  getWorkerMetadata,
  selectWorker,
} from "./WorkerExtractorAdapter"
import type {
  ExtractionResult,
  ExtractOptions,
  ExtractorServiceShape,
  MetadataOptions,
  MetadataResult,
} from "./extractor-types"
import { PluginCredentialVault } from "./plugin-credential-vault"
import {
  parseHttpBasicCredential,
  applyHttpBasicCredential,
} from "../../plugins/http-basic-credential"
import { CloudflareEnv } from "./CloudflareEnv"
import {
  extractFromOfficial,
  getOfficialManifest,
  getOfficialMetadata,
} from "./OfficialExtractorAdapter"
import { OFFICIAL_EXTRACTOR_ID } from "../../constants"

const getHostname = (value: string): string => new URL(value).hostname

const getMeteredPluginId = (pluginId: string) => {
  if (
    pluginId === "bhadoo-google-drive-index" ||
    pluginId === "onedrive-index" ||
    pluginId === "direct"
  ) {
    return pluginId
  }
  return undefined
}

export class ExtractorService extends Context.Service<
  ExtractorService,
  ExtractorServiceShape
>()("app/effect/services/ExtractorService") {
  static readonly layer = Layer.effect(
    ExtractorService,
    Effect.gen(function* () {
      const convex = yield* ConvexService
      const credentialVault = yield* PluginCredentialVault
      const environment = yield* CloudflareEnv

      const resolveUserPlugin = Effect.fn("ExtractorService.resolveUserPlugin")(
        function* (targetUrl: string, accessToken: string | undefined) {
          if (!accessToken) {
            return yield* resolvePlugin(targetUrl)
          }
          const configuredDomain = yield* convex
            .query(
              api.pluginDomains.getByDomain,
              { domain: getHostname(targetUrl) },
              { accessToken }
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
          if (configuredDomain) {
            return yield* resolvePluginById(configuredDomain.pluginId)
          }
          return yield* resolvePlugin(targetUrl)
        }
      )

      const extract = Effect.fn("ExtractorService.extract")(function* (
        options: ExtractOptions
      ): Effect.fn.Return<
        ExtractionResult,
        ExtractionError | ValidationError | UnauthorizedError
      > {
        const targetUrl = options.url
        if (!isSafeUrl(targetUrl)) {
          return yield* new ValidationError({
            message: "Invalid or unsafe URL",
          })
        }
        if (options.userId && options.accessToken) {
          const workers = yield* convex
            .query(
              api.userWorkers.list,
              {},
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
          const worker = yield* selectWorker(
            workers,
            targetUrl,
            options.workerId
          )
          if (worker) {
            return yield* extractFromWorker(
              worker,
              targetUrl,
              options.kind ?? "source",
              undefined,
              options.requestId
            )
          }
          if (options.workerId && options.workerId !== OFFICIAL_EXTRACTOR_ID) {
            return yield* new ValidationError({
              message: "The saved extractor worker is unavailable.",
            })
          }

          const officialManifest = yield* getOfficialManifest(
            environment,
            options.requestId
          ).pipe(Effect.option)
          const manifest =
            officialManifest._tag === "Some"
              ? officialManifest.value
              : undefined
          const source = manifest
            ? getMatchedExtractorSource(manifest, targetUrl)
            : undefined
          if (options.workerId === OFFICIAL_EXTRACTOR_ID && !source) {
            return yield* new ValidationError({
              message: "The saved extractor worker is unavailable.",
            })
          }
          if (source) {
            let password: string | undefined
            let basicAuth: { username: string; password: string } | undefined
            if (source.credential) {
              const domain = getHostname(targetUrl)
              const encryptedCredential = yield* convex
                .query(
                  api.pluginDomains.getCredentialByDomain,
                  { domain },
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
            return yield* extractFromOfficial(
              environment,
              targetUrl,
              options.kind ?? "source",
              { password, basicAuth },
              options.requestId
            )
          }
        }

        const plugin = yield* resolveUserPlugin(targetUrl, options.accessToken)
        if (plugin.requiresAuth && !options.userId) {
          return yield* new UnauthorizedError({
            message: `${plugin.name} links only work for registered users.`,
          })
        }

        let password: string | undefined
        let authenticatedTargetUrl = targetUrl
        if (plugin.credential && options.userId && options.accessToken) {
          const domain = getHostname(targetUrl)
          const encryptedCredential = yield* convex
            .query(
              api.pluginDomains.getCredentialByDomain,
              { domain },
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
          if (
            encryptedCredential &&
            encryptedCredential.pluginId === plugin.credential.pluginId
          ) {
            const decryptedCredential = yield* credentialVault
              .decrypt(encryptedCredential, {
                userId: options.userId,
                pluginId: plugin.credential.pluginId,
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
            if (plugin.credential.kind === "domain-password") {
              password = decryptedCredential
            } else {
              authenticatedTargetUrl = applyHttpBasicCredential(
                targetUrl,
                parseHttpBasicCredential(decryptedCredential)
              )
            }
          }
        }

        const meteredPluginId = getMeteredPluginId(plugin.id)
        if (meteredPluginId && options.userId && options.accessToken) {
          yield* convex
            .mutation(
              api.usage.consumeOfficialPlugin,
              { pluginId: meteredPluginId },
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

        return yield* extractFromPlugin(
          plugin,
          authenticatedTargetUrl,
          password
        )
      })

      const getMetadata = Effect.fn("ExtractorService.getMetadata")(function* (
        options: MetadataOptions
      ): Effect.fn.Return<MetadataResult, ValidationError | ConvexError> {
        if (!isSafeUrl(options.url)) {
          return yield* new ValidationError({
            message: "Invalid or unsafe URL",
          })
        }

        if (options.userId && options.accessToken) {
          const workers = yield* convex.query(
            api.userWorkers.list,
            {},
            { accessToken: options.accessToken }
          )
          const worker = yield* selectWorker(workers, options.url)
          if (worker) {
            const metadata = yield* getWorkerMetadata(worker, options.url)
            if (metadata) {
              return metadata
            }
          }

          const officialManifest = yield* getOfficialManifest(environment).pipe(
            Effect.option
          )
          if (officialManifest._tag === "Some") {
            const metadata = getOfficialMetadata(
              officialManifest.value,
              options.url
            )
            if (metadata) {
              return metadata
            }
          }
        }

        const plugin = yield* resolveUserPlugin(
          options.url,
          options.accessToken
        )
        let metadataUrl = options.url
        if (
          plugin.credential?.kind === "http-basic" &&
          options.userId &&
          options.accessToken
        ) {
          const domain = getHostname(options.url)
          const encryptedCredential = yield* convex.query(
            api.pluginDomains.getCredentialByDomain,
            { domain },
            { accessToken: options.accessToken }
          )
          if (
            encryptedCredential &&
            encryptedCredential.pluginId === plugin.credential.pluginId
          ) {
            const decryptedCredential = yield* credentialVault
              .decrypt(encryptedCredential, {
                userId: options.userId,
                pluginId: plugin.credential.pluginId,
                domain,
              })
              .pipe(
                Effect.mapError(
                  (cause) =>
                    new ConvexError({
                      message: "Could not read plugin credentials",
                      cause,
                    })
                )
              )
            metadataUrl = applyHttpBasicCredential(
              options.url,
              parseHttpBasicCredential(decryptedCredential)
            )
          }
        }
        return yield* getPluginMetadata(plugin, {
          ...options,
          url: metadataUrl,
        })
      })

      return ExtractorService.of({ extract, getMetadata })
    })
  )
}
