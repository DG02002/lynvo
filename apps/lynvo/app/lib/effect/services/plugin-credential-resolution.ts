import type {
  HttpBasicAuth,
  PluginMetadata,
} from "@lynvo/plugin-server-protocol"
import { Effect } from "effect"
import { api } from "../../../../convex/_generated/api"
import { parseHttpBasicCredential } from "../../plugins/http-basic-credential"
import { ExtractionError } from "../errors"
import type { ConvexServiceShape } from "./ConvexService"
import type { PluginCredentialVaultShape } from "./plugin-credential-vault"

export interface ResolvedPluginCredential {
  readonly password?: string
  readonly basicAuth?: HttpBasicAuth
}

export interface ResolvePluginCredentialOptions {
  readonly targetUrl: string
  readonly userId: string
  readonly accessToken: string
  readonly serviceToken: string
  readonly pluginServerId: string
  readonly plugin: PluginMetadata
  readonly inlineBasicAuth?: HttpBasicAuth
}

export const resolvePluginCredential = Effect.fn(
  "PluginCredentialResolution.resolvePluginCredential"
)(function* (
  convex: ConvexServiceShape,
  credentialVault: PluginCredentialVaultShape,
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

  const domain = new URL(options.targetUrl).hostname
  const encryptedCredential = yield* convex
    .query(
      api.pluginDomains.getCredentialByDomainForService,
      {
        domain,
        pluginServerId: options.pluginServerId,
        serviceToken: options.serviceToken,
      },
      { accessToken: options.accessToken }
    )
    .pipe(
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
