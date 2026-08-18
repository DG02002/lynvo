import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials"
import { createAccount, convexAuth } from "@convex-dev/auth/server"
import type { DataModel } from "./_generated/dataModel"
import { internal } from "./_generated/api"
import { internalQuery } from "./_generated/server"
import { v } from "convex/values"
import {
  normalizeUsername,
  validatePassword,
  validateUsername,
} from "../app/lib/auth-policy"
import { verifyAuthPreflightToken } from "./authGateway"
import { hashPasswordSecret, verifyPasswordSecret } from "./passwordCrypto"
import { verifyCredentialsAccount } from "./credentialsVerification"
import { synchronizeAccountCapacityAfterCreation } from "./accountCapacity"
import {
  ACCOUNT_INACTIVITY_LIMIT_MS,
  SESSION_TOTAL_DURATION_MS,
} from "./constants"
import { z } from "zod"

declare const process: {
  env: {
    AUTH_GATEWAY_SECRET?: string
  }
}

const syntheticEmail = (normalizedUsername: string) =>
  `${normalizedUsername}@users.lynvo.local`

const nonEmptyStringSchema = z.string().min(1)

const requireString = <Value>(value: Value, message: string): string => {
  const result = nonEmptyStringSchema.safeParse(value)
  if (!result.success) {
    throw new Error(message)
  }
  return result.data
}

const requirePositiveSafeInteger = <Value>(
  value: Value,
  message: string
): number => {
  const parsed = Number(requireString(value, message))
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(message)
  }
  return parsed
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

export const getCredentialsAccount = internalQuery({
  args: { normalizedUsername: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      userId: v.id("users"),
      secret: v.optional(v.string()),
      passwordChangePendingAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (accountQuery) =>
        accountQuery
          .eq("provider", "credentials")
          .eq("providerAccountId", args.normalizedUsername)
      )
      .unique()
    if (!account) {
      return null
    }
    const user = await ctx.db.get("users", account.userId)
    if (!user) {
      return null
    }
    return {
      userId: user._id,
      secret: account.secret,
      passwordChangePendingAt: user.passwordChangePendingAt,
    }
  },
})

const credentialsProvider = ConvexCredentials<DataModel>({
  crypto: passwordCrypto,
  authorize: async (params, ctx) => {
    const flow = requireString(params.flow, "Missing auth flow")
    console.info("security.convex_auth.authorize_start", {
      flow,
      hasUsername: nonEmptyStringSchema.safeParse(params.username).success,
      hasPassword: nonEmptyStringSchema.safeParse(params.password).success,
      hasPreflightToken: nonEmptyStringSchema.safeParse(params.preflightToken)
        .success,
      hasCode: nonEmptyStringSchema.safeParse(params.code).success,
    })

    if (flow === "device") {
      const code = requireString(params.code, "Code is required")
      const pollSecret = requireString(
        params.pollSecret,
        "Polling secret is required"
      )
      const record = await ctx.runMutation(
        internal.deviceAuth.claimAuthorizedCode,
        {
          code,
          pollSecret,
          now: Date.now(),
          attemptId: requireString(
            params.exchangeAttemptId,
            "Exchange attempt is required"
          ),
          generation: requirePositiveSafeInteger(
            params.issuanceGeneration,
            "Issuance generation is required"
          ),
        }
      )
      console.info("security.qr_exchanged")
      return { userId: record.userId, sessionId: record.sessionId }
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
      const existingAccount = await ctx.runQuery(
        internal.auth.getCredentialsAccount,
        { normalizedUsername }
      )
      if (existingAccount) {
        return null
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

    const account = await ctx.runQuery(internal.auth.getCredentialsAccount, {
      normalizedUsername,
    })
    const verification = await verifyCredentialsAccount(
      account ?? undefined,
      password
    )
    if (verification.kind === "invalid-credentials") {
      return null
    }
    if (verification.account.passwordChangePendingAt) {
      throw new Error("Password change is in progress. Try again shortly.")
    }
    console.info("security.signin_success", {
      userId: verification.account.userId,
    })
    return { userId: verification.account.userId }
  },
})

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [credentialsProvider],
  callbacks: {
    afterUserCreatedOrUpdated: async (ctx, { existingUserId }) => {
      if (existingUserId === null) {
        await synchronizeAccountCapacityAfterCreation(ctx)
      }
    },
  },
  session: {
    totalDurationMs: SESSION_TOTAL_DURATION_MS,
    inactiveDurationMs: ACCOUNT_INACTIVITY_LIMIT_MS,
  },
  signIn: {
    maxFailedAttempsPerHour: 10,
  },
  jwt: {
    async customClaims(ctx, { userId, sessionId }) {
      const user = await ctx.db.get("users", userId)
      return {
        username: user?.username,
        sessionId,
      }
    },
  },
})
