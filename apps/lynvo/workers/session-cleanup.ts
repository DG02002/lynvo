import { ConvexHttpClient } from "convex/browser"
import { api } from "../convex/_generated/api"
import { SESSION_CLEANUP_TOKEN_TTL_MS } from "../convex/constants"
import { signSessionCleanupToken } from "../app/lib/auth-gateway"
import { createAuthSessionModule } from "./auth-session"

export interface SessionCleanupCompleted {
  readonly kind: "completed"
}

export interface SessionCleanupUnavailable {
  readonly kind: "unavailable"
}

export interface SessionCleanupModule {
  readonly record: (
    workerSessionId: string,
    issuanceGeneration?: number
  ) => Promise<SessionCleanupCompleted | SessionCleanupUnavailable>
  readonly drain: () => Promise<
    SessionCleanupCompleted | SessionCleanupUnavailable
  >
}

export interface SessionCleanupEnvironment {
  readonly VITE_CONVEX_URL: string
  readonly AUTH_GATEWAY_SECRET: string
  readonly WORKER_AUTH_SESSION: Env["WORKER_AUTH_SESSION"]
}

const createServiceToken = (environment: SessionCleanupEnvironment) =>
  signSessionCleanupToken(
    environment.AUTH_GATEWAY_SECRET,
    Date.now() + SESSION_CLEANUP_TOKEN_TTL_MS
  )

export const createSessionCleanupModule = (
  environment: SessionCleanupEnvironment
): SessionCleanupModule => {
  const authSession = createAuthSessionModule(environment.WORKER_AUTH_SESSION)
  const createClient = () => new ConvexHttpClient(environment.VITE_CONVEX_URL)

  return {
    record: async (workerSessionId, issuanceGeneration) => {
      try {
        const serviceToken = await createServiceToken(environment)
        await createClient().mutation(api.sessionCleanup.enqueue, {
          serviceToken,
          workerSessionIds: [workerSessionId],
          issuanceGeneration,
        })
        return { kind: "completed" }
      } catch {
        return { kind: "unavailable" }
      }
    },
    drain: async () => {
      try {
        const serviceToken = await createServiceToken(environment)
        const client = createClient()
        const pendingTargets = await client.query(
          api.sessionCleanup.listPending,
          { serviceToken }
        )
        for (const target of pendingTargets) {
          const result = await authSession.revoke(
            target.workerSessionId,
            target.issuanceGeneration
          )
          if (result.kind === "unavailable") {
            return result
          }
          await client.mutation(api.sessionCleanup.complete, {
            serviceToken,
            workerSessionId: target.workerSessionId,
            issuanceGeneration: target.issuanceGeneration,
          })
        }
        return { kind: "completed" }
      } catch {
        return { kind: "unavailable" }
      }
    },
  }
}
