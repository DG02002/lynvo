import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials"
import {
  createAccount,
  retrieveAccount,
  convexAuth,
} from "@convex-dev/auth/server"
import type { GenericId } from "convex/values"
import type { DataModel } from "./_generated/dataModel"
import { api } from "./_generated/api"
import {
  normalizeUsername,
  validatePassword,
  validateUsername,
} from "../app/lib/auth-policy"
import { verifyAuthPreflightToken } from "./authGateway"
import { hashPasswordSecret, verifyPasswordSecret } from "./passwordCrypto"
import {
  ACCOUNT_INACTIVITY_LIMIT_MS,
  SESSION_TOTAL_DURATION_MS,
} from "./constants"

declare const process: {
  env: {
    AUTH_GATEWAY_SECRET?: string
  }
}

const syntheticEmail = (normalizedUsername: string) =>
  `${normalizedUsername}@users.lynvo.local`

const requireString = (value: unknown, message: string): string => {
  if (typeof value !== "string" || !value) {
    throw new Error(message)
  }
  return value
}

const verifyPreflight = async (
  token: string,
  flow: "signUp" | "signIn",
  normalizedUsername: string
) => {
  const secret = process.env.AUTH_GATEWAY_SECRET
  if (!secret) {
    throw new Error("Auth gateway is not configured")
  }
  const payload = await verifyAuthPreflightToken(token, secret)
  if (
    payload.flow !== flow ||
    payload.normalizedUsername !== normalizedUsername
  ) {
    throw new Error("Invalid auth preflight token")
  }
}

const passwordCrypto = {
  async hashSecret(password: string) {
    return await hashPasswordSecret(password)
  },
  async verifySecret(password: string, hash: string) {
    return await verifyPasswordSecret(password, hash)
  },
}

const credentialsProvider = ConvexCredentials<DataModel>({
  crypto: passwordCrypto,
  authorize: async (params, ctx) => {
    const flow = requireString(params.flow, "Missing auth flow")
    console.info("security.convex_auth.authorize_start", {
      flow,
      hasUsername:
        typeof params.username === "string" && params.username !== "",
      hasPassword:
        typeof params.password === "string" && params.password !== "",
      hasPreflightToken:
        typeof params.preflightToken === "string" &&
        params.preflightToken !== "",
      hasCode: typeof params.code === "string" && params.code !== "",
    })

    if (flow === "device") {
      const code = requireString(params.code, "Code is required")
      const record = await ctx.runQuery(api.tv.getAuthorizedCode, {
        code,
      })
      if (!record) {
        console.info("security.qr_exchange_failed", { reason: "not_approved" })
        throw new Error("Code not approved")
      }
      await ctx.runMutation(api.tv.consumeCode, { code })
      console.info("security.qr_exchanged")
      return { userId: record.userId as GenericId<"users"> }
    }

    const username = requireString(params.username, "Username is required")
    const password = requireString(params.password, "Password is required")
    const preflightToken = requireString(
      params.preflightToken,
      "Security check is required"
    )
    const normalizedUsername = normalizeUsername(username)

    if (flow !== "signUp" && flow !== "signIn") {
      throw new Error("Invalid auth flow")
    }
    const usernameError = validateUsername(username)
    if (usernameError) {
      console.info("security.convex_auth.username_rejected", {
        flow,
        reason: usernameError,
      })
      throw new Error(usernameError)
    }
    await verifyPreflight(preflightToken, flow, normalizedUsername)
    console.info("security.convex_auth.preflight_verified", { flow })

    if (flow === "signUp") {
      const passwordError = validatePassword(password, username)
      if (passwordError) {
        console.info("security.signup_rejected", { reason: passwordError })
        throw new Error(passwordError)
      }
      const now = Date.now()
      const created = await createAccount(ctx, {
        provider: "credentials",
        account: { id: normalizedUsername, secret: password },
        profile: {
          email: syntheticEmail(normalizedUsername),
          name: username,
          username,
          normalizedUsername,
          createdAt: now,
          lastActiveAt: now,
        },
        shouldLinkViaEmail: false,
        shouldLinkViaPhone: false,
      })
      console.info("security.signup_success", { userId: created.user._id })
      return { userId: created.user._id }
    }

    const retrieved = await retrieveAccount(ctx, {
      provider: "credentials",
      account: { id: normalizedUsername, secret: password },
    })
    console.info("security.signin_success", { userId: retrieved.user._id })
    return { userId: retrieved.user._id }
  },
})

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [credentialsProvider],
  session: {
    totalDurationMs: SESSION_TOTAL_DURATION_MS,
    inactiveDurationMs: ACCOUNT_INACTIVITY_LIMIT_MS,
  },
  signIn: {
    maxFailedAttempsPerHour: 10,
  },
  jwt: {
    async customClaims(ctx, { userId, sessionId }) {
      const user = await ctx.db.get(userId)
      return {
        username: user?.username,
        sessionId,
      }
    },
  },
})
