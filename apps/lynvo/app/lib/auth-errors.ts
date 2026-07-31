const INVALID_CREDENTIAL_MESSAGES = ["InvalidAccountId", "InvalidSecret"]

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export const classifyAuthSignInError = (error: unknown, flow: string) => {
  const message = errorMessage(error)

  if (
    flow === "signIn" &&
    INVALID_CREDENTIAL_MESSAGES.some((candidate) => message.includes(candidate))
  ) {
    return Object.freeze({
      code: "invalid_credentials",
      error:
        "The username or password is incorrect. Check both fields, then try again.",
      retryable: false,
      status: 401,
    })
  }

  if (message.includes("TooManyFailedAttempts")) {
    return Object.freeze({
      code: "rate_limited",
      error: "Too many login attempts. Wait, then try again.",
      retryable: true,
      status: 429,
    })
  }

  if (flow === "signUp" && /Account .+ already exists/.test(message)) {
    return Object.freeze({
      code: "account_exists",
      error: "An account with this username already exists.",
      retryable: false,
      status: 409,
    })
  }

  return Object.freeze({
    code: "service_unavailable",
    error:
      flow === "signUp"
        ? "Account creation is temporarily unavailable. Try again later."
        : "Login is temporarily unavailable. Try again later.",
    retryable: true,
    status: 503,
  })
}
