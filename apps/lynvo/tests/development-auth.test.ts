import { describe, expect, it } from "vitest"
import { getUserSession } from "../app/lib/auth"
import {
  DEVELOPMENT_AUTH_EMAIL,
  DEVELOPMENT_AUTH_DISPLAY_NAME,
  DEVELOPMENT_AUTH_SESSION_ID,
  DEVELOPMENT_AUTH_USER_ID,
  isDevelopmentAuthBypassEnabled,
} from "../workers/d1/development-auth"
import { createFakeD1Database } from "./support/fake-d1"

interface TestEnvironmentOptions {
  readonly environment?: "development" | "production"
  readonly noAuth?: string | boolean
}

interface TestEnvironment {
  DB: D1Database
  ENVIRONMENT: "development" | "production"
  LYNVO_NO_AUTH?: string | boolean
}

const createEnvironment = ({
  environment = "development",
  noAuth,
}: TestEnvironmentOptions = {}) => {
  const testEnvironment: TestEnvironment = {
    DB: createFakeD1Database(() => ({ rows: [] })),
    ENVIRONMENT: environment,
  }
  if (noAuth !== undefined) {
    testEnvironment.LYNVO_NO_AUTH = noAuth
  }
  // SAFETY: The auth helper only reads the D1 binding and environment fields supplied here.
  return testEnvironment as Env
}

describe("development auth bypass", () => {
  it("only enables the bypass for a development build and environment", () => {
    expect(
      isDevelopmentAuthBypassEnabled({
        ENVIRONMENT: "development",
        LYNVO_NO_AUTH: "true",
      })
    ).toBe(true)
    expect(
      isDevelopmentAuthBypassEnabled({
        ENVIRONMENT: "production",
        LYNVO_NO_AUTH: "true",
      })
    ).toBe(false)
    expect(
      isDevelopmentAuthBypassEnabled({
        ENVIRONMENT: "development",
        LYNVO_NO_AUTH: "false",
      })
    ).toBe(false)
  })

  it("resolves the fixed local identity without a session cookie", async () => {
    const result = await getUserSession(
      new Request("https://lynvo.test"),
      createEnvironment({ noAuth: "true" })
    )

    expect(result.user).toEqual({
      sub: DEVELOPMENT_AUTH_USER_ID,
      email: DEVELOPMENT_AUTH_EMAIL,
      name: DEVELOPMENT_AUTH_DISPLAY_NAME,
      sid: DEVELOPMENT_AUTH_SESSION_ID,
    })
    expect(result.sessionExpiresAt).toBeGreaterThan(Date.now())
  })

  it("does not bypass authentication outside the development environment", async () => {
    const result = await getUserSession(
      new Request("https://lynvo.test"),
      createEnvironment({ environment: "production", noAuth: "true" })
    )

    expect(result).toEqual({ user: null, sessionExpiresAt: undefined })
  })
})
