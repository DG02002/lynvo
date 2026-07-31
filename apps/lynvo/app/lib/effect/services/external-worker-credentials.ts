import { Effect, Schema } from "effect"
import { CredentialVaultError } from "../errors"

export interface EncryptedExternalWorkerCredential {
  readonly apiKeyCiphertext: string
  readonly apiKeyNonce: string
  readonly apiKeyAlgorithm: "AES-256-GCM"
  readonly apiKeyVersion: number
}

interface StoredExternalWorkerCredential {
  readonly _id: string
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

const vaultRequest = Effect.fn("ExternalWorkerCredentials.vaultRequest")(
  function* (
    environment: Env,
    userId: string,
    workerId: string,
    path: "/encrypt" | "/decrypt",
    body: Record<string, unknown>
  ): Effect.fn.Return<unknown, CredentialVaultError> {
    const response = yield* Effect.tryPromise({
      try: () =>
        environment.EXTERNAL_WORKER_CREDENTIAL_VAULT.getByName(
          `${userId}:${workerId}`
        ).fetch(`https://credential-vault.internal${path}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, workerId, ...body }),
        }),
      catch: (cause) =>
        new CredentialVaultError({
          message: "External worker credential protection is unavailable",
          cause,
        }),
    })
    if (!response.ok) {
      return yield* new CredentialVaultError({
        message: "External worker credential protection is unavailable",
      })
    }
    const payload = yield* Effect.tryPromise({
      try: () => response.json(),
      catch: (cause) =>
        new CredentialVaultError({
          message: "External worker credential response is invalid",
          cause,
        }),
    })
    return payload
  }
)

export const encryptExternalWorkerApiKey = Effect.fn(
  "ExternalWorkerCredentials.encryptExternalWorkerApiKey"
)(function* (
  environment: Env,
  userId: string,
  workerId: string,
  apiKey: string
): Effect.fn.Return<EncryptedExternalWorkerCredential, CredentialVaultError> {
  const encrypted = yield* vaultRequest(
    environment,
    userId,
    workerId,
    "/encrypt",
    { apiKey }
  )
  const decoded = yield* Schema.decodeUnknownEffect(EncryptedResponse)(
    encrypted
  ).pipe(
    Effect.mapError(
      (cause) =>
        new CredentialVaultError({
          message: "External worker credential response is invalid",
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

export const decryptExternalWorker = Effect.fn(
  "ExternalWorkerCredentials.decryptExternalWorker"
)(function* <Worker extends StoredExternalWorkerCredential>(
  environment: Env,
  userId: string,
  worker: Worker
): Effect.fn.Return<
  Worker & { readonly apiKey: string },
  CredentialVaultError
> {
  if (
    !worker.apiKeyCiphertext ||
    !worker.apiKeyNonce ||
    !worker.apiKeyAlgorithm ||
    worker.apiKeyVersion === undefined
  ) {
    return yield* new CredentialVaultError({
      message: "External worker credential migration is incomplete",
    })
  }
  const decrypted = yield* vaultRequest(
    environment,
    userId,
    worker._id,
    "/decrypt",
    {
      credential: {
        ciphertext: worker.apiKeyCiphertext,
        nonce: worker.apiKeyNonce,
        algorithm: worker.apiKeyAlgorithm,
        keyVersion: worker.apiKeyVersion,
      },
    }
  )
  const decoded = yield* Schema.decodeUnknownEffect(DecryptedResponse)(
    decrypted
  ).pipe(
    Effect.mapError(
      (cause) =>
        new CredentialVaultError({
          message: "External worker credential response is invalid",
          cause,
        })
    )
  )
  return { ...worker, apiKey: decoded.apiKey }
})

export const decryptExternalWorkers = Effect.fn(
  "ExternalWorkerCredentials.decryptExternalWorkers"
)(function* <Worker extends StoredExternalWorkerCredential>(
  environment: Env,
  userId: string,
  workers: ReadonlyArray<Worker>
) {
  return yield* Effect.forEach(
    workers,
    (worker) => decryptExternalWorker(environment, userId, worker),
    { concurrency: 8 }
  )
})
