import type {
  HttpBasicAuth,
  PluginMetadata,
} from "@dg02002/lynvo-plugin-server-protocol"
import { Effect } from "effect"
import { getD1Database } from "../../../../workers/d1/db"
import { getPluginCredentialByDomainForService } from "../../../../workers/d1/plugin-domains"
import { parseHttpBasicCredential } from "../../plugins/http-basic-credential"
import { ExtractionError } from "../errors"
import type { PluginCredentialVaultContract } from "./plugin-credential-vault"

export interface ResolvedPluginCredential {
  readonly password?: string
  readonly basicAuth?: HttpBasicAuth
}

export interface ResolvePluginCredentialOptions {
  readonly environment: Env
  readonly targetUrl: string
  readonly userId: string
  readonly pluginServerId: string
  readonly plugin: PluginMetadata
  readonly inlineBasicAuth?: HttpBasicAuth
}

export const resolvePluginCredential = Effect.fn(
  "PluginCredentialResolution.resolvePluginCredential"
)(function* (
  credentialVault: PluginCredentialVaultContract,
  options: ResolvePluginCredentialOptions
): Effect.fn.Return<ResolvedPluginCredential, ExtractionError> {
  if (!options.plugin.credential) {
    return {}
  }
  if (
    options.plugin.credential.kind === "http-basic" &&
    options.inlineBasicAuth
  ) {
    return { basicAuth: options.inlineBasicAuth }
  }

  const database = getD1Database(options.environment)
  if (!database) {
    return yield* new ExtractionError({
      message: "Stored Plugin credentials are unavailable.",
      url: options.targetUrl,
    })
  }

  const domain = new URL(options.targetUrl).hostname
  const encryptedCredential = yield* Effect.tryPromise({
    try: () =>
      getPluginCredentialByDomainForService(database, options.userId, {
        domain,
        pluginServerId: options.pluginServerId,
      }),
    catch: (cause) =>
      new ExtractionError({
        message:
          cause instanceof Error
            ? cause.message
            : "Stored Plugin credentials are unavailable.",
        url: options.targetUrl,
      }),
  }).pipe(
    Effect.mapError(
      (error) =>
        new ExtractionError({
          message: error.message,
          url: options.targetUrl,
        })
    )
  )
  if (encryptedCredential?.pluginId !== options.plugin.id) {
    if (options.plugin.credential.required) {
      return yield* new ExtractionError({
        message: "Required Plugin credential is unavailable.",
        url: options.targetUrl,
      })
    }
    return {}
  }

  const credential = yield* credentialVault
    .decrypt(encryptedCredential, {
      userId: options.userId,
      pluginServerId: options.pluginServerId,
      pluginId: options.plugin.id,
      domain,
    })
    .pipe(
      Effect.mapError(
        (error) =>
          new ExtractionError({
            message: error.message,
            url: options.targetUrl,
          })
      )
    )
  if (options.plugin.credential.kind === "domain-password") {
    return { password: credential }
  }
  const basicAuth = yield* Effect.try({
    try: () => parseHttpBasicCredential(credential),
    catch: () =>
      new ExtractionError({
        message: "Stored HTTP Basic Auth credential is invalid",
        url: options.targetUrl,
      }),
  })
  return { basicAuth }
})
