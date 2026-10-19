import { describe, expect, it } from "vitest"

import { sessionExpiredCopy } from "~/lib/session-copy"

const createTaggedError = (tag: string, message?: string) => {
  if (message === undefined) {
    return { _tag: tag }
  }
  return { _tag: tag, message }
}
import {
  csrfExpiredMessage,
  extractionErrorMessage,
  getUserFacingErrorMessage,
  unsupportedLinkMessage,
} from "~/lib/user-facing-error"

describe("getUserFacingErrorMessage", () => {
  it.each([
    ["UnauthorizedError", undefined, sessionExpiredCopy.retry],
    ["CsrfError", undefined, csrfExpiredMessage],
    ["ValidationError", "The URL is invalid.", "The URL is invalid."],
    ["NotFoundError", "The item was not found.", "The item was not found."],
    ["UsageLimitError", "The limit was reached.", "The limit was reached."],
    [
      "PluginServerRegistrationError",
      "The Plugin Server could not be registered.",
      "The Plugin Server could not be registered.",
    ],
    ["ProxyProviderError", "The proxy failed.", "The proxy failed."],
    [
      "PluginDomainNotFoundError",
      "The Plugin Domain was not found.",
      "The Plugin Domain was not found.",
    ],
    [
      "PluginServerUnavailableError",
      "The Plugin Server is unavailable.",
      "The Plugin Server is unavailable.",
    ],
    [
      "PluginCredentialChangeSupersededError",
      "The credential change was superseded.",
      "The credential change was superseded.",
    ],
    ["ExtractionError", undefined, extractionErrorMessage],
  ] as const)("maps %s to one copy", (tag, message, expected) => {
    expect(
      getUserFacingErrorMessage(createTaggedError(tag, message), "fallback")
    ).toBe(expected)
  })

  it("maps unsupported extraction responses to their supported-link copy", () => {
    expect(
      getUserFacingErrorMessage(
        { _tag: "ExtractionError", message: "UNSUPPORTED_URL" },
        "fallback"
      )
    ).toBe(unsupportedLinkMessage)
  })

  it("uses one session-expired message for every save path", () => {
    expect(
      getUserFacingErrorMessage({ _tag: "UnauthorizedError" }, "fallback")
    ).toBe(sessionExpiredCopy.retry)
  })

  it("does not expose untrusted implementation messages", () => {
    expect(
      getUserFacingErrorMessage(
        new Error("Decode error at /api/extract"),
        "Try again."
      )
    ).toBe("Try again.")
  })
})
