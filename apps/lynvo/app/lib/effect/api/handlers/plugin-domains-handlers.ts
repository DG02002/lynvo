import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../api"
import { CurrentUser } from "../middleware"
import {
  normalizePluginDomain,
  parsePluginDomainInput,
} from "../../../plugin-domain"
import { BackendError, ValidationError } from "../../errors"
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
          yield* Effect.tryPromise({
            try: () =>
              upsertPluginDomain(database, user.id, {
                domain,
                pluginServerId: payload.pluginServerId,
                pluginId: payload.pluginId,
                credential,
                now: Date.now(),
              }),
            catch: (cause) =>
              new BackendError({
                message: "The plugin domain couldn’t be saved",
                cause,
              }),
          })
          return { success: true }
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
          const password = payload.password
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
              new BackendError({
                message: "The plugin domain couldn’t be updated",
                cause,
              }),
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
          yield* Effect.tryPromise({
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
              new BackendError({
                message: "The plugin credential couldn’t be saved",
                cause,
              }),
          })
          return { success: true }
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
          yield* Effect.tryPromise({
            try: () =>
              deletePluginDomainCredential(database, user.id, {
                domainId: params.domainId,
                now: Date.now(),
              }),
            catch: (cause) =>
              new BackendError({
                message: "The plugin credential couldn’t be removed",
                cause,
              }),
          })
          return { success: true }
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
          yield* Effect.tryPromise({
            try: () =>
              deletePluginDomainById(database, user.id, {
                domainId: params.domainId,
                now: Date.now(),
              }),
            catch: (cause) =>
              new BackendError({
                message: "The plugin domain couldn’t be deleted",
                cause,
              }),
          })
          return { success: true }
        })
      )
)
