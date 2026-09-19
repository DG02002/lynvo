import { describe, expect, it } from "vitest"

import {
  getSaveError,
  getSaveErrorMessage,
} from "~/features/links/use-link-actions/save-error-message"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"

describe("getSaveErrorMessage", () => {
  it("classifies validation failures as unsupported link errors", () => {
    expect(
      getSaveError({
        _tag: "ValidationError",
        message: "Private and local network addresses are not supported.",
      })
    ).toEqual({
      kind: "unsupported",
      message: "Private and local network addresses are not supported.",
    })
  })

  it("hides transport and decode implementation details", () => {
    expect(
      getSaveErrorMessage(new Error("Decode error (400 GET /api/extract)"))
    ).toBe("The link couldn’t be opened. Check the link, then try again.")
  })

  it("keeps authentication and validation errors actionable", () => {
    expect(getSaveErrorMessage({ _tag: "UnauthorizedError" })).toBe(
      "The session expired. Log in, then save the link again."
    )
    expect(
      getSaveErrorMessage({
        _tag: "ValidationError",
        message: "Please enter a supported URL.",
      })
    ).toBe("Please enter a supported URL.")
  })

  it("uses a source-neutral extraction message", () => {
    expect(getSaveErrorMessage({ _tag: "ExtractionError" })).toBe(
      "Links couldn’t be loaded from this address. Check the link, then try again."
    )
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
