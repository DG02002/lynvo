import { Context, Effect, Layer } from "effect"
import { getLynvoManifestExtension } from "@lynvo/extractor-protocol"
import { ConvexService } from "./ConvexService"
import { api } from "../../../../convex/_generated/api"
import { isSafeUrl } from "../../../lib/ssrf"
import { ConvexError, ExtractionError, ValidationError } from "../errors"
import { extractFromPlugin, getPluginMetadata } from "./PluginExtractorAdapter"
import { nativeDirectLinkPlugin } from "../../plugins/direct"
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
import { parseHttpBasicCredential } from "../../plugins/http-basic-credential"
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

      const extract = Effect.fn("ExtractorService.extract")(function* (
        options: ExtractOptions
      ): Effect.fn.Return<ExtractionResult, ExtractionError | ValidationError> {
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
          const configuredDomain = yield* convex
            .query(
              api.pluginDomains.getByDomain,
              { domain: getHostname(targetUrl) },
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
          const source = manifest
            ? configuredDomain
              ? getLynvoManifestExtension(manifest).sources?.find(
                  (candidate) => candidate.id === configuredDomain.pluginId
                )
              : undefined
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
            const configuredDomain = yield* convex.query(
              api.pluginDomains.getByDomain,
              { domain: getHostname(options.url) },
              { accessToken: options.accessToken }
            )
            const metadata = getOfficialMetadata(
              officialManifest.value,
              options.url,
              configuredDomain?.pluginId
            )
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
