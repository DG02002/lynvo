import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../api"
import { CurrentUser } from "../middleware"
import { versionedSuccess } from "../versioned-response"
import {
  normalizePluginDomain,
  parsePluginDomainInput,
} from "../../../plugin-domain"
import {
  BackendError,
  PluginCredentialChangeSupersededError as PluginCredentialChangeSupersededApiError,
  PluginDomainNotFoundError as PluginDomainNotFoundApiError,
  PluginServerUnavailableError as PluginServerUnavailableApiError,
  ValidationError,
} from "../../errors"
import { PluginCredentialVault } from "../../services/plugin-credential-vault"
import { CloudflareEnv } from "../../services/cloudflare-env"
import { serializeHttpBasicCredential } from "../../../plugins/http-basic-credential"
import { getD1Database } from "../../../../../workers/d1/db"
import {
  beginPluginDomainCredentialChange,
  deletePluginDomainById,
  deletePluginDomainCredential,
  finalizePluginDomainCredentialChange,
  listPluginDomains,
  upsertPluginDomain,
} from "../../../../../workers/d1/plugin-domains"
import {
  PluginCredentialChangeSupersededError as D1PluginCredentialChangeSupersededError,
  PluginDomainNotFoundError as D1PluginDomainNotFoundError,
  PluginServerUnavailableError as D1PluginServerUnavailableError,
} from "../../../../../workers/d1/errors"

const mapPluginDomainMutationError = (cause: unknown, fallback: string) => {
  if (cause instanceof D1PluginDomainNotFoundError) {
    return new PluginDomainNotFoundApiError({ message: cause.message })
  }
  if (cause instanceof D1PluginServerUnavailableError) {
    return new PluginServerUnavailableApiError({ message: cause.message })
  }
  if (cause instanceof D1PluginCredentialChangeSupersededError) {
    return new PluginCredentialChangeSupersededApiError({
      message: cause.message,
    })
  }
  return new BackendError({ message: fallback, cause })
}

const mapPluginServerAvailabilityError = (cause: unknown, fallback: string) =>
  cause instanceof D1PluginServerUnavailableError
    ? new PluginServerUnavailableApiError({ message: cause.message })
    : new BackendError({ message: fallback, cause })

const mapPluginDomainNotFoundError = (cause: unknown, fallback: string) =>
  cause instanceof D1PluginDomainNotFoundError
    ? new PluginDomainNotFoundApiError({ message: cause.message })
    : new BackendError({ message: fallback, cause })

const validateDomain = (value: string) =>
  Effect.try({
    try: () => normalizePluginDomain(value),
    catch: (details) =>
      new ValidationError({ message: "Enter a valid plugin domain", details }),
  })

const validateDomainInput = (value: string) =>
  Effect.try({
    try: () => parsePluginDomainInput(value),
    catch: (details) =>
      new ValidationError({ message: "Enter a valid plugin domain", details }),
  })

export const PluginDomainsHandlers = HttpApiBuilder.group(
  Api,
  "pluginDomains",
  (handlers) =>
    handlers
      .handle("list", () =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const environment = yield* CloudflareEnv
          const database = getD1Database(environment)
          if (!database) {
            return yield* new BackendError({
              message: "Account data is temporarily unavailable",
            })
          }
          return yield* Effect.tryPromise({
            try: () => listPluginDomains(database, user.id),
            catch: (cause) =>
              new BackendError({
                message: "Account data is temporarily unavailable",
                cause,
              }),
          })
        })
      )
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const environment = yield* CloudflareEnv
          const vault = yield* PluginCredentialVault
          const database = getD1Database(environment)
          if (!database) {
            return yield* new BackendError({
              message: "Account data is temporarily unavailable",
            })
          }
          const parsedInput = yield* validateDomainInput(payload.domain)
          const domain = yield* validateDomain(parsedInput.url)
          const username = payload.username || parsedInput.username
          const password = payload.username
            ? payload.password
            : parsedInput.password || payload.password
          const credentialValue = username
            ? serializeHttpBasicCredential(username, password || "")
            : password || undefined
          let credential:
            | {
                readonly ciphertext: string
                readonly nonce: string
                readonly algorithm: "AES-256-GCM"
                readonly keyVersion: number
              }
            | undefined
          if (credentialValue) {
            const encrypted = yield* vault.encrypt(credentialValue, {
              userId: user.id,
              pluginServerId: payload.pluginServerId,
              pluginId: payload.pluginId,
              domain,
            })
            credential = {
              ciphertext: encrypted.ciphertext,
              nonce: encrypted.nonce,
              algorithm: encrypted.algorithm,
              keyVersion: encrypted.keyVersion,
            }
          }
          const { dataVersion } = yield* Effect.tryPromise({
            try: () =>
              upsertPluginDomain(database, user.id, {
                domain,
                pluginServerId: payload.pluginServerId,
                pluginId: payload.pluginId,
                credential,
                now: Date.now(),
              }),
            catch: (cause) =>
              mapPluginServerAvailabilityError(
                cause,
                "The plugin domain couldn’t be saved"
              ),
          })
          return versionedSuccess(dataVersion)
        })
      )
      .handle("setCredential", ({ params, payload }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const environment = yield* CloudflareEnv
          const vault = yield* PluginCredentialVault
          const database = getD1Database(environment)
          if (!database) {
            return yield* new BackendError({
              message: "Account data is temporarily unavailable",
            })
          }
          const { password } = payload
          if (!password) {
            return yield* new ValidationError({
              message: "Password is required",
            })
          }
          const attempt = yield* Effect.tryPromise({
            try: () =>
              beginPluginDomainCredentialChange(database, user.id, {
                domainId: params.domainId,
                now: Date.now(),
              }),
            catch: (cause) =>
              mapPluginDomainMutationError(
                cause,
                "The plugin domain couldn’t be updated"
              ),
          })
          const credentialValue = payload.username
            ? serializeHttpBasicCredential(payload.username, password)
            : password
          const encrypted = yield* vault.encrypt(credentialValue, {
            userId: user.id,
            pluginServerId: attempt.pluginServerId,
            pluginId: attempt.pluginId,
            domain: attempt.domain,
          })
          const dataVersion = yield* Effect.tryPromise({
            try: () =>
              finalizePluginDomainCredentialChange(database, user.id, {
                domainId: attempt.id,
                generation: attempt.generation,
                attemptId: attempt.attemptId,
                credential: {
                  ciphertext: encrypted.ciphertext,
                  nonce: encrypted.nonce,
                  algorithm: encrypted.algorithm,
                  keyVersion: encrypted.keyVersion,
                },
                now: Date.now(),
              }),
            catch: (cause) =>
              mapPluginDomainMutationError(
                cause,
                "The plugin credential couldn’t be saved"
              ),
          })
          return versionedSuccess(dataVersion)
        })
      )
      .handle("deleteCredential", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const environment = yield* CloudflareEnv
          const database = getD1Database(environment)
          if (!database) {
            return yield* new BackendError({
              message: "Account data is temporarily unavailable",
            })
          }
          const dataVersion = yield* Effect.tryPromise({
            try: () =>
              deletePluginDomainCredential(database, user.id, {
                domainId: params.domainId,
                now: Date.now(),
              }),
            catch: (cause) =>
              mapPluginDomainMutationError(
                cause,
                "The plugin credential couldn’t be removed"
              ),
          })
          return versionedSuccess(dataVersion)
        })
      )
      .handle("delete", ({ params }) =>
        Effect.gen(function* () {
          const user = yield* CurrentUser
          const environment = yield* CloudflareEnv
          const database = getD1Database(environment)
          if (!database) {
            return yield* new BackendError({
              message: "Account data is temporarily unavailable",
            })
          }
          const dataVersion = yield* Effect.tryPromise({
            try: () =>
              deletePluginDomainById(database, user.id, {
                domainId: params.domainId,
                now: Date.now(),
              }),
            catch: (cause) =>
              mapPluginDomainNotFoundError(
                cause,
                "The plugin domain couldn’t be deleted"
              ),
          })
          return versionedSuccess(dataVersion)
        })
      )
)
