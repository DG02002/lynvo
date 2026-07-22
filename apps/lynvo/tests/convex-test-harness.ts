/// <reference types="vite/client" />

import { convexTest } from "convex-test"
import schema from "../convex/schema"

const AUTH_SUBJECT_SEPARATOR = "|"

const modules = import.meta.glob("../convex/**/*.ts")

export const createConvexTest = () => convexTest(schema, modules)

export const insertTestUser = async (
  convex: ReturnType<typeof createConvexTest>,
  username: string
) => {
  return await convex.run(async (context) => {
    const now = Date.now()
    const userId = await context.db.insert("users", {
      username,
      normalizedUsername: username.toLowerCase(),
      createdAt: now,
      lastActiveAt: now,
    })
    const sessionId = await context.db.insert("authSessions", {
      userId,
      expirationTime: now + 60_000,
    })
    return { userId, sessionId }
  })
}

export const asAuthenticatedUser = (
  convex: ReturnType<typeof createConvexTest>,
  userId: string,
  sessionId: string
) =>
  convex.withIdentity({
    subject: `${userId}${AUTH_SUBJECT_SEPARATOR}${sessionId}`,
  })
