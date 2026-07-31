import { ConvexError } from "convex/values"
import type { QueryCtx, MutationCtx } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"

export interface AuthenticatedConvexContext {
  readonly auth: QueryCtx["auth"] | MutationCtx["auth"]
}

export const getAuthenticatedUserId = async (
  context: AuthenticatedConvexContext
): Promise<NonNullable<Awaited<ReturnType<typeof getAuthUserId>>>> => {
  const userId = await getAuthUserId(context)
  if (!userId) {
    throw new ConvexError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
    })
  }
  return userId
}

export const getAuthenticatedWritableUserId = async (
  context: AuthenticatedConvexContext & { readonly db: MutationCtx["db"] }
) => {
  const userId = await getAuthenticatedUserId(context)
  const user = await context.db.get("users", userId)
  if (!user || user.erasurePendingAt) {
    throw new Error("Account erasure is in progress")
  }
  return userId
}
