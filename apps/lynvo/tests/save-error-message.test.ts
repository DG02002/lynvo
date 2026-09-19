import { describe, expect, it } from "vitest"

import { SavedLinkCommandError } from "~/features/links/saved-link-command-failure"
import { getSaveError } from "~/features/links/use-link-actions/save-error-message"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"

describe("getSaveError", () => {
  it("classifies unsupported URL errors by structured code", () => {
    expect(
      getSaveError({
        _tag: "ExtractionError",
        message: "UNSUPPORTED_URL",
        detail: "URL is not supported.",
      })
    ).toEqual({
      kind: "unsupported",
      message: "URL is not supported.",
    })

    expect(
      getSaveError({
        _tag: "ValidationError",
        message: "Invalid or unsafe URL",
        details: { code: "UNSUPPORTED_URL" },
      })
    ).toEqual({
      kind: "unsupported",
      message: "Invalid or unsafe URL",
    })

    expect(
      getSaveError(
        new SavedLinkCommandError({
          failure: {
            kind: "validation",
            code: "UNSUPPORTED_URL",
            message: "URL is not supported.",
          },
        })
      )
    ).toEqual({
      kind: "unsupported",
      message: "URL is not supported.",
    })
  })

  it("hides transport and decode implementation details", () => {
    expect(
      getSaveError(new Error("Decode error (400 GET /api/extract)"))
    ).toEqual({
      kind: "generic",
      message: "The link couldn’t be opened. Check the link, then try again.",
    })
  })

  it("keeps authentication and availability errors generic", () => {
    expect(getSaveError({ _tag: "UnauthorizedError" })).toEqual({
      kind: "generic",
      message: "The session expired. Log in, then save the link again.",
    })

    const availabilityMessages = [
      "The saved Plugin Server is unavailable.",
      "Sign in to extract links with the Lynvo Plugin Server.",
      "The saved Plugin is unavailable.",
    ]

    for (const message of availabilityMessages) {
      expect(getSaveError({ _tag: "ValidationError", message })).toEqual({
        kind: "generic",
        message,
      })
    }

    expect(
      getSaveError({
        _tag: "ValidationError",
        message: "Please enter a supported URL.",
      })
    ).toEqual({
      kind: "generic",
      message: "Please enter a supported URL.",
    })
  })

  it("uses a source-neutral extraction message", () => {
    expect(getSaveError({ _tag: "ExtractionError" })).toEqual({
      kind: "generic",
      message:
        "Links couldn’t be loaded from this address. Check the link, then try again.",
    })
  })

  it("only preserves explicitly trusted errors", () => {
    expect(
      getUserFacingErrorMessage(
        new Error("Username does not match."),
        "Account update failed."
      )
    ).toBe("Account update failed.")
    expect(
      getUserFacingErrorMessage(
        new Error("ResponseError at GET /api/plugin-servers"),
        "Could not refresh Plugin Servers."
      )
    ).toBe("Could not refresh Plugin Servers.")
  })
})
