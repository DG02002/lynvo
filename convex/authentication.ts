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
