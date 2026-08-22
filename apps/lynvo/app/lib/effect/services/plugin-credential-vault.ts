import { Context, Effect, Layer } from "effect"
import { CredentialVaultError } from "../errors"
import { CloudflareEnv } from "./cloudflare-env"
import type { SealedRecord } from "~/lib/security/sealed-record"
import { sealRecord, unsealRecord } from "~/lib/security/sealed-record"
import { SEALED_RECORD_KEY_VERSION } from "~/lib/security/constants"

export interface EncryptedPluginCredential extends SealedRecord {}

export interface PluginCredentialContext {
  readonly userId: string
  readonly pluginServerId: string
  readonly pluginId: string
  readonly domain: string
}

export interface PluginCredentialVaultContract {
  readonly encrypt: (
    password: string,
    context: PluginCredentialContext
  ) => Effect.Effect<EncryptedPluginCredential, CredentialVaultError>
  readonly decrypt: (
    credential: EncryptedPluginCredential,
    context: PluginCredentialContext
  ) => Effect.Effect<string, CredentialVaultError>
}

export const createPluginCredentialAdditionalData = (
  context: PluginCredentialContext
): Uint8Array<ArrayBuffer> =>
  new TextEncoder().encode(
    `${context.userId}\u0000${context.pluginServerId}\u0000${context.pluginId}\u0000${context.domain}\u0000${SEALED_RECORD_KEY_VERSION}`
  )

export class PluginCredentialVault extends Context.Service<
  PluginCredentialVault,
  PluginCredentialVaultContract
>()("app/effect/services/PluginCredentialVault") {
  static readonly layer = Layer.effect(
    PluginCredentialVault,
    Effect.gen(function* () {
      const environment = yield* CloudflareEnv
      const encrypt = Effect.fn("PluginCredentialVault.encrypt")(function* (
        password: string,
        context: PluginCredentialContext
      ) {
        return yield* Effect.tryPromise({
          try: () =>
            sealRecord({
              encodedKey: environment.PLUGIN_CREDENTIAL_ENCRYPTION_KEY,
              additionalData: createPluginCredentialAdditionalData(context),
              plaintext: new TextEncoder().encode(password),
            }),
          catch: (cause) =>
            new CredentialVaultError({
              message: "Could not encrypt plugin credential",
              cause,
            }),
        })
      })

      const decrypt = Effect.fn("PluginCredentialVault.decrypt")(function* (
        credential: EncryptedPluginCredential,
        context: PluginCredentialContext
      ) {
        const plaintext = yield* Effect.tryPromise({
          try: () =>
            unsealRecord({
              encodedKey: environment.PLUGIN_CREDENTIAL_ENCRYPTION_KEY,
              additionalData: createPluginCredentialAdditionalData(context),
              record: credential,
            }),
          catch: (cause) =>
            new CredentialVaultError({
              message: "Could not decrypt plugin credential",
              cause,
            }),
        })
        return new TextDecoder().decode(plaintext)
      })

      return PluginCredentialVault.of({ encrypt, decrypt })
    })
  )
}
