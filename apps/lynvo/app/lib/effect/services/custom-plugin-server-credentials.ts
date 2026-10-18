import type { JsonValue } from "@dg02002/lynvo-plugin-server-protocol"
import { Effect, Schema } from "effect"
import type {
  SealedProxyProviderCredential,
  StoredProxyProviderCredential,
} from "~shared/proxy-provider-credentials"

import { CredentialVaultError } from "../errors"

export interface EncryptedCustomPluginServerCredential {
  readonly apiKeyCiphertext: string
  readonly apiKeyNonce: string
  readonly apiKeyAlgorithm: "AES-256-GCM"
  readonly apiKeyVersion: number
}

interface StoredCustomPluginServerCredential {
  readonly id: string
  readonly apiKeyCiphertext?: string
  readonly apiKeyNonce?: string
  readonly apiKeyAlgorithm?: "AES-256-GCM"
  readonly apiKeyVersion?: number
}

const EncryptedResponse = Schema.Struct({
  ciphertext: Schema.String,
  nonce: Schema.String,
  algorithm: Schema.Literal("AES-256-GCM"),
  keyVersion: Schema.Number,
})

const DecryptedResponse = Schema.Struct({ apiKey: Schema.String })

interface VaultRequestInput {
  readonly environment: Env
  readonly userId: string
  /** Vault namespace and authenticated-data scope. */
  readonly scopeId: string
  readonly path: "/encrypt" | "/decrypt"
  readonly body: Record<string, JsonValue>
}

const vaultRequest = Effect.fn("CustomPluginServerCredentials.vaultRequest")(
  function* ({
    environment,
    userId,
    scopeId,
    path,
    body,
  }: VaultRequestInput): Effect.fn.Return<JsonValue, CredentialVaultError> {
    const response = yield* Effect.tryPromise({
      try: () =>
        environment.PLUGIN_SERVER_CREDENTIAL_VAULT.getByName(
          `${userId}:${scopeId}`
        ).fetch(`https://credential-vault.internal${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, scopeId, ...body }),
        }),
      catch: (cause) =>
        new CredentialVaultError({
          message: "External pluginServer credential protection is unavailable",
          cause,
        }),
    })
    if (!response.ok) {
      return yield* new CredentialVaultError({
        message: "External pluginServer credential protection is unavailable",
      })
    }
    const payload = yield* Effect.tryPromise({
      try: async () => {
        const json = await response.json()
        // SAFETY: Parsed JSON from vault response is a JsonValue.
        return json as JsonValue
      },
      catch: (cause) =>
        new CredentialVaultError({
          message: "External pluginServer credential response is invalid",
          cause,
        }),
    })
    return payload
  }
)

interface EncryptCustomPluginServerApiKeyInput {
  readonly environment: Env
  readonly userId: string
  readonly pluginServerId: string
  readonly apiKey: string
}

export const encryptCustomPluginServerApiKey = Effect.fn(
  "CustomPluginServerCredentials.encryptCustomPluginServerApiKey"
)(function* ({
  environment,
  userId,
  pluginServerId,
  apiKey,
}: EncryptCustomPluginServerApiKeyInput): Effect.fn.Return<
  EncryptedCustomPluginServerCredential,
  CredentialVaultError
> {
  const encrypted = yield* vaultRequest({
    environment,
    userId,
    scopeId: pluginServerId,
    path: "/encrypt",
    body: { apiKey },
  })
  const decoded = yield* Schema.decodeUnknownEffect(EncryptedResponse)(
    encrypted
  ).pipe(
    Effect.mapError(
      (cause) =>
        new CredentialVaultError({
          message: "External pluginServer credential response is invalid",
          cause,
        })
    )
  )
  return {
    apiKeyCiphertext: decoded.ciphertext,
    apiKeyNonce: decoded.nonce,
    apiKeyAlgorithm: decoded.algorithm,
    apiKeyVersion: decoded.keyVersion,
  }
})

export const decryptCustomPluginServer = Effect.fn(
  "CustomPluginServerCredentials.decryptCustomPluginServer"
)(function* <PluginServer extends StoredCustomPluginServerCredential>(
  environment: Env,
  userId: string,
  pluginServer: PluginServer
): Effect.fn.Return<
  PluginServer & { readonly apiKey: string },
  CredentialVaultError
> {
  if (
    !pluginServer.apiKeyCiphertext ||
    !pluginServer.apiKeyNonce ||
    !pluginServer.apiKeyAlgorithm ||
    pluginServer.apiKeyVersion === undefined
  ) {
    return yield* new CredentialVaultError({
      message: "Custom Plugin Server credential record is incomplete",
    })
  }
  const decrypted = yield* vaultRequest({
    environment,
    userId,
    scopeId: pluginServer.id,
    path: "/decrypt",
    body: {
      credential: {
        ciphertext: pluginServer.apiKeyCiphertext,
        nonce: pluginServer.apiKeyNonce,
        algorithm: pluginServer.apiKeyAlgorithm,
        keyVersion: pluginServer.apiKeyVersion,
      },
    },
  })
  const decoded = yield* Schema.decodeUnknownEffect(DecryptedResponse)(
    decrypted
  ).pipe(
    Effect.mapError(
      (cause) =>
        new CredentialVaultError({
          message: "Custom Plugin Server credential response is invalid",
          cause,
        })
    )
  )
  return { ...pluginServer, apiKey: decoded.apiKey }
})

interface ProxyProviderVaultScopeInput {
  readonly environment: Env
  readonly userId: string
  readonly provider: string
}

const proxyProviderScopeId = (provider: string): string =>
  `proxy-provider:${provider}`

export const encryptProxyProviderToken = Effect.fn(
  "CustomPluginServerCredentials.encryptProxyProviderToken"
)(function* ({
  environment,
  userId,
  provider,
  token,
}: ProxyProviderVaultScopeInput & { readonly token: string }): Effect.fn.Return<
  SealedProxyProviderCredential,
  CredentialVaultError
> {
  const encrypted = yield* vaultRequest({
    environment,
    userId,
    scopeId: proxyProviderScopeId(provider),
    path: "/encrypt",
    body: { apiKey: token },
  })
  const decoded = yield* Schema.decodeUnknownEffect(EncryptedResponse)(
    encrypted
  ).pipe(
    Effect.mapError(
      (cause) =>
        new CredentialVaultError({
          message: "External pluginServer credential response is invalid",
          cause,
        })
    )
  )
  return {
    ciphertext: decoded.ciphertext,
    nonce: decoded.nonce,
    algorithm: decoded.algorithm,
    version: decoded.keyVersion,
  }
})

export const decryptProxyProviderToken = Effect.fn(
  "CustomPluginServerCredentials.decryptProxyProviderToken"
)(function* ({
  environment,
  userId,
  provider,
  sealed,
}: ProxyProviderVaultScopeInput & {
  readonly sealed: StoredProxyProviderCredential
}): Effect.fn.Return<string, CredentialVaultError> {
  const decrypted = yield* vaultRequest({
    environment,
    userId,
    // Legacy ciphertext is authenticated against the server id used before migration.
    scopeId: sealed.legacyPluginServerId ?? proxyProviderScopeId(provider),
    path: "/decrypt",
    body: {
      credential: {
        ciphertext: sealed.ciphertext,
        nonce: sealed.nonce,
        algorithm: sealed.algorithm,
        keyVersion: sealed.version,
      },
    },
  })
  const decoded = yield* Schema.decodeUnknownEffect(DecryptedResponse)(
    decrypted
  ).pipe(
    Effect.mapError(
      (cause) =>
        new CredentialVaultError({
          message: "External pluginServer credential response is invalid",
          cause,
        })
    )
  )
  return decoded.apiKey
})

export const decryptCustomPluginServers = Effect.fn(
  "CustomPluginServerCredentials.decryptCustomPluginServers"
)(function* <PluginServer extends StoredCustomPluginServerCredential>(
  environment: Env,
  userId: string,
  pluginServers: ReadonlyArray<PluginServer>
) {
  return yield* Effect.forEach(
    pluginServers,
    (pluginServer) =>
      decryptCustomPluginServer(environment, userId, pluginServer),
    { concurrency: 8 }
  )
})
