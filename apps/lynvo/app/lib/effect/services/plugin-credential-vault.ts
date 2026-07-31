import { Context, Effect, Layer } from "effect"
import { CredentialVaultError } from "../errors"
import { CloudflareEnv } from "./CloudflareEnv"

export interface EncryptedPluginCredential {
  readonly ciphertext: string
  readonly nonce: string
  readonly algorithm: "AES-256-GCM"
  readonly keyVersion: number
}

export interface PluginCredentialContext {
  readonly userId: string
  readonly workerId: string
  readonly pluginId: string
  readonly domain: string
}

export interface PluginCredentialVaultShape {
  readonly encrypt: (
    password: string,
    context: PluginCredentialContext
  ) => Effect.Effect<EncryptedPluginCredential, CredentialVaultError>
  readonly decrypt: (
    credential: EncryptedPluginCredential,
    context: PluginCredentialContext
  ) => Effect.Effect<string, CredentialVaultError>
}

const ALGORITHM = "AES-256-GCM"
const AES_GCM_NAME = "AES-GCM"
const NONCE_LENGTH_BYTES = 12
const KEY_LENGTH_BYTES = 32
const KEY_VERSION = 1

const decodeBase64 = (value: string): Uint8Array<ArrayBuffer> => {
  const decodedValue = atob(value)
  const bytes = new Uint8Array(decodedValue.length)
  for (let index = 0; index < decodedValue.length; index += 1) {
    bytes[index] = decodedValue.charCodeAt(index)
  }
  return bytes
}

const encodeBase64 = (value: ArrayBuffer): string => {
  const bytes = new Uint8Array(value)
  let binaryValue = ""
  for (const byte of bytes) {
    binaryValue += String.fromCharCode(byte)
  }
  return btoa(binaryValue)
}

export const createPluginCredentialAdditionalData = (
  context: PluginCredentialContext
): Uint8Array<ArrayBuffer> =>
  new TextEncoder().encode(
    `${context.userId}\u0000${context.workerId}\u0000${context.pluginId}\u0000${context.domain}\u0000${KEY_VERSION}`
  )

const importEncryptionKey = async (encodedKey: string): Promise<CryptoKey> => {
  const keyBytes = decodeBase64(encodedKey)
  if (keyBytes.byteLength !== KEY_LENGTH_BYTES) {
    throw new Error("PLUGIN_CREDENTIAL_MASTER_KEY must contain 32 bytes")
  }
  return await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: AES_GCM_NAME },
    false,
    ["encrypt", "decrypt"]
  )
}

export class PluginCredentialVault extends Context.Service<
  PluginCredentialVault,
  PluginCredentialVaultShape
>()("app/effect/services/PluginCredentialVault") {
  static readonly layer = Layer.effect(
    PluginCredentialVault,
    Effect.gen(function* () {
      const environment = yield* CloudflareEnv
      const getEncryptionKey = () =>
        Effect.tryPromise({
          try: () =>
            importEncryptionKey(environment.PLUGIN_CREDENTIAL_MASTER_KEY),
          catch: (cause) =>
            new CredentialVaultError({
              message: "Plugin credential encryption is unavailable",
              cause,
            }),
        })

      const encrypt = Effect.fn("PluginCredentialVault.encrypt")(function* (
        password: string,
        context: PluginCredentialContext
      ) {
        const encryptionKey = yield* getEncryptionKey()
        const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH_BYTES))
        const ciphertext = yield* Effect.tryPromise({
          try: () =>
            crypto.subtle.encrypt(
              {
                name: AES_GCM_NAME,
                iv: nonce,
                additionalData: createPluginCredentialAdditionalData(context),
              },
              encryptionKey,
              new TextEncoder().encode(password)
            ),
          catch: (cause) =>
            new CredentialVaultError({
              message: "Could not encrypt plugin credential",
              cause,
            }),
        })
        const encryptedCredential: EncryptedPluginCredential = {
          ciphertext: encodeBase64(ciphertext),
          nonce: encodeBase64(nonce.buffer),
          algorithm: ALGORITHM,
          keyVersion: KEY_VERSION,
        }
        return encryptedCredential
      })

      const decrypt = Effect.fn("PluginCredentialVault.decrypt")(function* (
        credential: EncryptedPluginCredential,
        context: PluginCredentialContext
      ) {
        if (
          credential.algorithm !== ALGORITHM ||
          credential.keyVersion !== KEY_VERSION
        ) {
          return yield* new CredentialVaultError({
            message: "Unsupported plugin credential encryption version",
          })
        }
        const encryptionKey = yield* getEncryptionKey()
        const plaintext = yield* Effect.tryPromise({
          try: () =>
            crypto.subtle.decrypt(
              {
                name: AES_GCM_NAME,
                iv: decodeBase64(credential.nonce),
                additionalData: createPluginCredentialAdditionalData(context),
              },
              encryptionKey,
              decodeBase64(credential.ciphertext)
            ),
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
