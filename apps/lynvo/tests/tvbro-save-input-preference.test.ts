import { describe, expect, it } from "vitest"
import {
  getShouldHideTvBroSaveInput,
  shouldHideSaveInput,
} from "~/features/site/settings/tvbro-save-input-preference"

describe("TVBro Save input preference", () => {
  it("hides the input by default", () => {
    expect(getShouldHideTvBroSaveInput()).toBe(true)
  })

  it("only hides the input in TVBro when the preference is enabled", () => {
    expect(shouldHideSaveInput(true, true)).toBe(true)
    expect(shouldHideSaveInput(true, false)).toBe(false)
    expect(shouldHideSaveInput(false, true)).toBe(false)
  })
})
