import type {
  HttpBasicAuth,
  PluginMetadata,
  PluginServerManifest,
} from "@dg02002/lynvo-plugin-server-protocol"
import { Effect } from "effect"
import { LYNVO_PLUGIN_SERVER_ID } from "../../constants"
import { ExtractionError, ValidationError } from "../errors"
import type { ExtractionResult, MetadataResult } from "./extraction-types"
import {
  discoverLynvoPlugin,
  extractFromLynvoPluginServer,
  findLynvoPlugin,
  getLynvoPluginServerManifest,
  getLynvoPluginServerMetadata,
} from "./lynvo-plugin-server-adapter"
import { resolvePluginCredential } from "./plugin-credential-resolution"
import type { PluginCredentialVaultContract } from "./plugin-credential-vault"
import { getD1Database } from "../../../../workers/d1/db"
import { getPluginDomainByDomain } from "../../../../workers/d1/plugin-domains"
import {
  MANAGED_PLUGIN_IDS,
  reserveManagedExtraction,
  settleManagedExtraction,
} from "../../../../workers/d1/usage"
import type { ManagedPluginId } from "../../../../workers/d1/usage"

export interface LynvoExtractionAdapterOptions {
  readonly environment: Env
  readonly targetUrl: string
  readonly userId: string
  readonly requestId: string
  readonly pluginId?: string
  readonly kind: "source" | "node"
  readonly inlineBasicAuth?: HttpBasicAuth
}

export interface LynvoPluginRoute {
  readonly manifest: PluginServerManifest
  readonly plugin: PluginMetadata
}

const selectLynvoPlugin = Effect.fn("LynvoExtractionAdapter.selectLynvoPlugin")(
  function* (
    options: LynvoExtractionAdapterOptions
  ): Effect.fn.Return<
    LynvoPluginRoute | undefined,
    ExtractionError | ValidationError
  > {
    const operationId = `${options.requestId}:${options.kind}`
    const manifest = yield* getLynvoPluginServerManifest(
      options.environment,
      options.requestId,
      operationId
    )
    const database = getD1Database(options.environment)
    const configuredDomain = database
      ? yield* Effect.tryPromise({
          try: () =>
            getPluginDomainByDomain(database, options.userId, {
              domain: new URL(options.targetUrl).hostname,
              pluginServerId: LYNVO_PLUGIN_SERVER_ID,
            }),
          catch: (cause) =>
            new ValidationError({
              message:
                cause instanceof Error
                  ? cause.message
                  : "The saved Plugin configuration is unavailable.",
              details: cause,
            }),
        })
      : null
    let plugin = findLynvoPlugin(
      manifest,
      options.targetUrl,
      options.pluginId ?? configuredDomain?.pluginId,
      false
    )
    if (!plugin && manifest.features.discovery && options.kind === "source") {
      const discovery = yield* discoverLynvoPlugin(
        options.environment,
        options.targetUrl,
        options.inlineBasicAuth,
        options.requestId,
        operationId
      )
      if (discovery.matched) {
        plugin = findLynvoPlugin(
          manifest,
          options.targetUrl,
          discovery.pluginId
        )
      }
    }
    if (!plugin) {
      plugin = findLynvoPlugin(manifest, options.targetUrl, undefined, true)
    }
    return plugin ? { manifest, plugin } : undefined
  }
)

const isManagedPluginId = (
  pluginIdentifier: string
): pluginIdentifier is ManagedPluginId =>
  MANAGED_PLUGIN_IDS.some(
    (managedIdentifier) => managedIdentifier === pluginIdentifier
  )

const toMeteredPluginId = (
  pluginIdentifier: string
): ManagedPluginId | undefined => {
  if (!isManagedPluginId(pluginIdentifier)) {
    return undefined
  }
  return pluginIdentifier
}

export const extractWithLynvoPluginServer = Effect.fn(
  "LynvoExtractionAdapter.extract"
)(function* (
  credentialVault: PluginCredentialVaultContract,
  options: LynvoExtractionAdapterOptions
): Effect.fn.Return<
  ExtractionResult | undefined,
  ExtractionError | ValidationError
> {
  const route = yield* selectLynvoPlugin(options)
  if (!route) {
    return undefined
  }
  const credentials = yield* resolvePluginCredential(credentialVault, {
    environment: options.environment,
    targetUrl: options.targetUrl,
    userId: options.userId,
    pluginServerId: LYNVO_PLUGIN_SERVER_ID,
    plugin: route.plugin,
    inlineBasicAuth: options.inlineBasicAuth,
  })
  const meteredPluginId = toMeteredPluginId(route.plugin.id)
  const operationId = `${options.requestId}:${options.kind}`
  if (meteredPluginId) {
    const database = getD1Database(options.environment)
    if (!database) {
      return yield* new ExtractionError({
        message: "Managed extraction metering is unavailable.",
        url: options.targetUrl,
      })
    }
    yield* Effect.tryPromise({
      try: () =>
        reserveManagedExtraction(database, options.userId, {
          operationId,
          pluginId: meteredPluginId,
          usageLimitsDisabled: process.env.DISABLE_USAGE_LIMITS === "true",
          now: Date.now(),
        }),
      catch: (cause) =>
        new ExtractionError({
          message:
            cause instanceof Error
              ? cause.message
              : "Managed extraction reservation failed.",
          url: options.targetUrl,
        }),
    })
  }
  const extraction = extractFromLynvoPluginServer(
    options.environment,
    options.targetUrl,
    options.kind,
    { pluginId: route.plugin.id, ...credentials },
    options.requestId,
    operationId
  )
  if (!meteredPluginId) {
    return yield* extraction
  }
  const database = getD1Database(options.environment)
  return yield* extraction.pipe(
    Effect.ensuring(
      database
        ? Effect.promise(() =>
            settleManagedExtraction(database, options.userId, {
              operationId,
              outcome: "consumed",
              now: Date.now(),
            }).catch(() => undefined)
          )
        : Effect.succeed(undefined)
    )
  )
})

export const getLynvoRouteMetadata = Effect.fn(
  "LynvoExtractionAdapter.getMetadata"
)(function* (
  options: LynvoExtractionAdapterOptions
): Effect.fn.Return<
  MetadataResult | undefined,
  ExtractionError | ValidationError
> {
  const route = yield* selectLynvoPlugin(options)
  return route
    ? getLynvoPluginServerMetadata(
        route.manifest,
        options.targetUrl,
        route.plugin.id
      )
    : undefined
})
