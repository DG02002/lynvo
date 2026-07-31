import { describe, expect, it } from "vitest"
import { classifyAuthSignInError } from "~/lib/auth-errors"

describe("auth sign-in errors", () => {
  it.each(["InvalidAccountId", "InvalidSecret"])(
    "classifies %s as invalid credentials",
    (message) => {
      expect(classifyAuthSignInError(new Error(message), "signIn")).toEqual({
        code: "invalid_credentials",
        error:
          "The username or password is incorrect. Check both fields, then try again.",
        retryable: false,
        status: 401,
      })
    }
  )

  it("classifies Convex Auth rate limiting without exposing internals", () => {
    expect(
      classifyAuthSignInError(new Error("TooManyFailedAttempts"), "signIn")
    ).toEqual({
      code: "rate_limited",
      error: "Too many login attempts. Wait, then try again.",
      retryable: true,
      status: 429,
    })
  })

  it("classifies an existing signup account as a conflict", () => {
    expect(
      classifyAuthSignInError(
        new Error("Account darshan already exists"),
        "signUp"
      )
    ).toEqual({
      code: "account_exists",
      error: "An account with this username already exists.",
      retryable: false,
      status: 409,
    })
  })

  it("classifies missing JWT configuration as service unavailable", () => {
    expect(
      classifyAuthSignInError(
        new Error("Missing environment variable `JWT_PRIVATE_KEY`"),
        "signUp"
      )
    ).toEqual({
      code: "service_unavailable",
      error: "Account creation is temporarily unavailable. Try again later.",
      retryable: true,
      status: 503,
    })
  })
})
