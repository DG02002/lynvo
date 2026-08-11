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
          const credentialValue = username
            ? serializeHttpBasicCredential(username, password || "")
            : password || undefined
          const domainId = yield* convex.mutation(
            api.pluginDomains.create,
            {
              domain,
              pluginServerId: payload.pluginServerId,
              pluginId: payload.pluginId,
            },
            { accessToken: user.accessToken }
          )
          if (credentialValue) {
            const attempt = yield* convex.mutation(
              api.pluginDomains.beginCredentialChange,
              { id: domainId },
              { accessToken: user.accessToken }
            )
            const credential = yield* vault.encrypt(credentialValue, {
              userId: user.id,
              pluginServerId: attempt.pluginServerId,
              pluginId: attempt.pluginId,
              domain: attempt.domain,
            })
            yield* convex.mutation(
              api.pluginDomains.finalizeCredentialChange,
              {
                id: attempt.id,
                generation: attempt.generation,
                attemptId: attempt.attemptId,
                credential,
              },
              { accessToken: user.accessToken }
            )
          }
          return { success: true }
        })
      )
      .handle("setCredential", ({ params, payload }) =>
        Effect.gen(function* () {
          const convex = yield* ConvexService
          const user = yield* CurrentUser
          const vault = yield* PluginCredentialVault
          const attempt = yield* convex.mutation(
            api.pluginDomains.beginCredentialChange,
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
            pluginServerId: attempt.pluginServerId,
            pluginId: attempt.pluginId,
            domain: attempt.domain,
          })
          yield* convex.mutation(
            api.pluginDomains.finalizeCredentialChange,
            {
              id: attempt.id,
              generation: attempt.generation,
              attemptId: attempt.attemptId,
              credential,
            },
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
