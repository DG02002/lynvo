import { describe, expect, it } from "vitest"

import { toPluginServerRegistrationError } from "~/lib/effect/errors"

describe("toPluginServerRegistrationError", () => {
  it("adds the registration error period once", () => {
    expect(
      toPluginServerRegistrationError({
        message: "Account data is temporarily unavailable",
      }).message
    ).toBe("Account data is temporarily unavailable.")

    expect(
      toPluginServerRegistrationError({
        message: "Account data is temporarily unavailable.",
      }).message
    ).toBe("Account data is temporarily unavailable.")
  })
})
