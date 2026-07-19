import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Api } from "../Api"
import { CurrentUser } from "../Middleware"
import { ConvexService } from "../../services/ConvexService"
import { api } from "../../../../../convex/_generated/api"
import {
  normalizePluginDomain,
  parsePluginDomainInput,
} from "../../../plugin-domain"
import { ValidationError } from "../../errors"
import { PluginCredentialVault } from "../../services/plugin-credential-vault"
import { serializeHttpBasicCredential } from "../../../plugins/http-basic-credential"
import { probeBhadooDomain } from "../../../plugins/bhadoo-domain-probe"

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
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          return yield* convex.query(
            api.pluginDomains.list,
            {},
            {
              accessToken: user.accessToken,
            }
          )
        })
      )
      .handle("create", ({ payload }) =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          const vault = yield* PluginCredentialVault
          const parsedInput = yield* validateDomainInput(payload.domain)
          const domain = yield* validateDomain(parsedInput.url)
          const username = payload.username || parsedInput.username
          const password = payload.username
            ? payload.password
            : parsedInput.password || payload.password
          if (payload.pluginId === "bhadoo-google-drive-index") {
            const status = yield* Effect.promise(() =>
              probeBhadooDomain(parsedInput.url, username, password)
            )
            if (status === 401) {
              return yield* new ValidationError({
                message: username
                  ? "The HTTP Basic Auth username or password is incorrect"
                  : "This domain requires HTTP Basic Auth credentials",
              })
            }
          }
          const credentialValue = username
            ? serializeHttpBasicCredential(username, password || "")
            : password || undefined
          const credential = credentialValue
            ? yield* vault.encrypt(credentialValue, {
                userId: user.id,
                pluginId: payload.pluginId,
                domain,
              })
            : undefined
          yield* convex.mutation(
            api.pluginDomains.create,
            {
              domain,
              pluginId: payload.pluginId,
              credential,
            },
            { accessToken: user.accessToken }
          )
          return { success: true }
        })
      )
      .handle("setCredential", ({ params, payload }) =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          const vault = yield* PluginCredentialVault
          const domain = yield* convex.query(
            api.pluginDomains.getById,
            { id: params.domainId },
            { accessToken: user.accessToken }
          )
          const password = payload.password
          if (!password) {
            return yield* new ValidationError({
              message: "Password is required",
            })
          }
          const credentialValue = payload.username
            ? serializeHttpBasicCredential(payload.username, password)
            : password
          const credential = yield* vault.encrypt(credentialValue, {
            userId: user.id,
            pluginId: domain.pluginId,
            domain: domain.domain,
          })
          yield* convex.mutation(
            api.pluginDomains.setCredential,
            { id: domain._id, credential },
            { accessToken: user.accessToken }
          )
          return { success: true }
        })
      )
      .handle("deleteCredential", ({ params }) =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          yield* convex.mutation(
            api.pluginDomains.deleteCredential,
            { id: params.domainId },
            { accessToken: user.accessToken }
          )
          return { success: true }
        })
      )
      .handle("delete", ({ params }) =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          yield* convex.mutation(
            api.pluginDomains.deleteById,
            {
              id: params.domainId,
            },
            { accessToken: user.accessToken }
          )
          return { success: true }
        })
      )
)
