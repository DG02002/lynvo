import { Context, Effect, Layer } from "effect"
import { ConvexService } from "./ConvexService"
import { api } from "../../../../convex/_generated/api"
import { isSafeUrl } from "../../../lib/ssrf"
import { ConvexError, ExtractionError, ValidationError } from "../errors"
import { extractFromPlugin, getPluginMetadata } from "./PluginExtractorAdapter"
import { nativeDirectLinkPlugin } from "../../plugins/direct"
import {
  discoverWorkerSource,
  extractFromWorker,
  getWorkerSource,
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
import { parseHttpBasicCredential } from "../../plugins/http-basic-credential"
import { CloudflareEnv } from "./CloudflareEnv"
import {
  discoverOfficialSource,
  extractFromOfficial,
  findOfficialManifestSource,
  getOfficialManifest,
  getOfficialMetadata,
} from "./OfficialExtractorAdapter"
import { OFFICIAL_EXTRACTOR_ID } from "../../constants"
import { signCredentialReadToken } from "../../../lib/auth-gateway"
import { CREDENTIAL_READ_TOKEN_TTL_MS } from "../../../../convex/constants"
import { extractHttpBasicCredential } from "../../plugins/http-basic-credential"

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

      const extract = Effect.fn("ExtractorService.extract")(function* (
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
          const workers = yield* convex
            .query(
              api.userWorkers.listForService,
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
          const worker = yield* selectWorker(
            workers,
            targetUrl,
            options.workerId
          )
          if (worker) {
            let source = yield* getWorkerSource(
              worker,
              targetUrl,
              options.sourceId
            )
            const discoveryAttempt =
              (options.kind ?? "source") === "source"
                ? yield* discoverWorkerSource(
                    worker,
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
              const discoveredSource = yield* getWorkerSource(
                worker,
                targetUrl,
                discovery.sourceId
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
                  { domain, workerId: worker._id, serviceToken },
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
                    workerId: worker._id,
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
            return yield* extractFromWorker(
              worker,
              targetUrl,
              options.kind ?? "source",
              { sourceId: source?.id, password, basicAuth },
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
          const configuredDomain = yield* convex
            .query(
              api.pluginDomains.getByDomain,
              {
                domain: getHostname(targetUrl),
                workerId: OFFICIAL_EXTRACTOR_ID,
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
            ? findOfficialManifestSource(
                manifest,
                targetUrl,
                options.sourceId ?? configuredDomain?.pluginId
              )
            : undefined
          if (
            !source &&
            manifest?.features.discovery &&
            (options.kind ?? "source") === "source"
          ) {
            const discoveryAttempt = yield* discoverOfficialSource(
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
              source = findOfficialManifestSource(
                manifest,
                targetUrl,
                discovery.sourceId
              )
            }
          }
          if (options.workerId === OFFICIAL_EXTRACTOR_ID && !source) {
            return yield* new ValidationError({
              message: "The saved extractor worker is unavailable.",
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
                    workerId: OFFICIAL_EXTRACTOR_ID,
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
                    workerId: OFFICIAL_EXTRACTOR_ID,
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
              { sourceId: source.id, password, basicAuth },
              options.requestId
            )
          }
        }

        return yield* extractFromPlugin(nativeDirectLinkPlugin, targetUrl)
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
          const serviceToken = yield* Effect.promise(() =>
            signCredentialReadToken(
              environment.AUTH_GATEWAY_SECRET,
              Date.now() + CREDENTIAL_READ_TOKEN_TTL_MS
            )
          )
          const workers = yield* convex.query(
            api.userWorkers.listForService,
            { serviceToken },
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
            const extractedAuth = extractHttpBasicCredential(options.url)
            const configuredDomain = yield* convex.query(
              api.pluginDomains.getByDomain,
              {
                domain: getHostname(extractedAuth.url),
                workerId: OFFICIAL_EXTRACTOR_ID,
              },
              { accessToken: options.accessToken }
            )
            let metadata = getOfficialMetadata(
              officialManifest.value,
              extractedAuth.url,
              configuredDomain?.pluginId
            )
            if (!metadata && officialManifest.value.features.discovery) {
              const discovery = yield* discoverOfficialSource(
                environment,
                extractedAuth.url,
                extractedAuth.basicAuth,
                options.requestId
              ).pipe(Effect.option)
              if (discovery._tag === "Some" && discovery.value.matched) {
                metadata = getOfficialMetadata(
                  officialManifest.value,
                  extractedAuth.url,
                  discovery.value.sourceId
                )
              }
            }
            if (metadata) {
              return metadata
            }
          }
        }

        return yield* getPluginMetadata(nativeDirectLinkPlugin, options)
      })

      return ExtractorService.of({ extract, getMetadata })
    })
  )
}
