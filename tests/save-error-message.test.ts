import { describe, expect, it } from "vitest"
import { getSaveErrorMessage } from "~/features/links/use-link-actions/save-error-message"
import { getUserFacingErrorMessage } from "~/lib/user-facing-error"

describe("getSaveErrorMessage", () => {
  it("hides transport and decode implementation details", () => {
    expect(
      getSaveErrorMessage(new Error("Decode error (400 GET /api/extract)"))
    ).toBe("Unable to process this link. Try again.")
  })

  it("keeps authentication and validation errors actionable", () => {
    expect(getSaveErrorMessage({ _tag: "UnauthorizedError" })).toBe(
      "Session expired. Sign in again."
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
      "Unable to extract links from this URL. Check the link and try again."
    )
  })

  it("preserves meaningful errors while hiding technical details", () => {
    expect(
      getUserFacingErrorMessage(
        new Error("Username does not match."),
        "Account update failed."
      )
    ).toBe("Username does not match.")
    expect(
      getUserFacingErrorMessage(
        new Error("ResponseError at GET /api/workers"),
        "Could not refresh extractors."
      )
    ).toBe("Could not refresh extractors.")
  })
})
