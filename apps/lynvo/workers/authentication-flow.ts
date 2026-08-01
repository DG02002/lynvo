import { ConvexHttpClient } from "convex/browser"
import { api } from "../convex/_generated/api"
import { createAuthSessionModule } from "./auth-session"

interface AuthenticationFlowEnvironment {
  readonly VITE_CONVEX_URL: string
  readonly WORKER_AUTH_SESSION: Env["WORKER_AUTH_SESSION"]
}

interface AuthenticationFlowInput {
  readonly provider: "credentials"
  readonly params: Record<string, string>
}

interface AuthenticationFlowBrowserState {
  readonly signingIn?: boolean
  readonly redirect?: string
  readonly started?: boolean
}

interface AuthenticationFlowCompleted {
  readonly kind: "completed"
  readonly browserState: AuthenticationFlowBrowserState
  readonly cookie?: string
  readonly hasTokens: boolean
}

interface AuthenticationFlowUnavailable {
  readonly kind: "unavailable"
}

interface AuthenticationTokens {
  readonly token: string
  readonly refreshToken: string
}

const readConvexSessionId = (accessToken: string): string | undefined => {
  const payloadSegment = accessToken.split(".")[1]
  if (!payloadSegment) {
    return undefined
  }
  try {
    const normalizedSegment = payloadSegment
      .replaceAll("-", "+")
      .replaceAll("_", "/")
      .padEnd(Math.ceil(payloadSegment.length / 4) * 4, "=")
    const payload: unknown = JSON.parse(atob(normalizedSegment))
    return typeof payload === "object" &&
      payload !== null &&
      "sessionId" in payload &&
      typeof payload.sessionId === "string" &&
      payload.sessionId.length > 0
      ? payload.sessionId
      : undefined
  } catch {
    return undefined
  }
}

interface WorkerAuthenticationFlow {
  readonly signIn: (
    input: AuthenticationFlowInput
  ) => Promise<AuthenticationFlowCompleted | AuthenticationFlowUnavailable>
}

const readTokens = (value: unknown): AuthenticationTokens | undefined => {
  if (
    typeof value !== "object" ||
    value === null ||
    !("tokens" in value) ||
    typeof value.tokens !== "object" ||
    value.tokens === null ||
    !("token" in value.tokens) ||
    !("refreshToken" in value.tokens) ||
    typeof value.tokens.token !== "string" ||
    typeof value.tokens.refreshToken !== "string"
  ) {
    return undefined
  }
  return {
    token: value.tokens.token,
    refreshToken: value.tokens.refreshToken,
  }
}

const readBrowserState = (value: unknown): AuthenticationFlowBrowserState => {
  if (typeof value !== "object" || value === null) {
    return {}
  }
  return {
    signingIn:
      "signingIn" in value && typeof value.signingIn === "boolean"
        ? value.signingIn
        : undefined,
    redirect:
      "redirect" in value && typeof value.redirect === "string"
        ? value.redirect
        : undefined,
    started:
      "started" in value && typeof value.started === "boolean"
        ? value.started
        : undefined,
  }
}

export const createWorkerAuthenticationFlow = (
  environment: AuthenticationFlowEnvironment
): WorkerAuthenticationFlow => ({
  signIn: async (input) => {
    const client = new ConvexHttpClient(environment.VITE_CONVEX_URL)
    const result = await client.action(api.auth.signIn, input)
    const tokens = readTokens(result)
    if (!tokens) {
      return {
        kind: "completed",
        browserState: readBrowserState(result),
        hasTokens: false,
      }
    }
    const deviceName = input.params.deviceName?.trim().slice(0, 80)
    const convexSessionId = readConvexSessionId(tokens.token)
    if (!convexSessionId) {
      return { kind: "unavailable" }
    }
    client.setAuth(tokens.token)
    if (deviceName) {
      await client.mutation(api.users.setCurrentSessionDevice, { deviceName })
    }
    const workerSessionId = crypto.randomUUID()
    const session = await createAuthSessionModule(
      environment.WORKER_AUTH_SESSION
    ).create({
      sessionId: workerSessionId,
      convexSessionId,
      accessToken: tokens.token,
      refreshToken: tokens.refreshToken,
      nowMs: Date.now(),
    })
    if (session.kind === "unavailable") {
      return session
    }
    try {
      await client.mutation(api.users.linkCurrentSessionWorker, {
        workerSessionId,
      })
    } catch {
      await createAuthSessionModule(environment.WORKER_AUTH_SESSION).revoke(
        workerSessionId
      )
      return { kind: "unavailable" }
    }
    return {
      kind: "completed",
      browserState: { signingIn: true },
      cookie: session.cookie,
      hasTokens: true,
    }
  },
})
