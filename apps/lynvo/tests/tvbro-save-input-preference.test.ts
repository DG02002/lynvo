import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  getShouldHideTvBroSaveInput,
  setShouldHideTvBroSaveInput,
  shouldHideSaveInput,
} from "~/features/site/settings/tvbro-save-input-preference"
import { createMemoryStorage } from "./memory-storage"

beforeEach(() => {
  vi.stubGlobal("localStorage", createMemoryStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("TVBro Save input preference", () => {
  it("hides the input by default", () => {
    expect(getShouldHideTvBroSaveInput()).toBe(true)
  })

  it("allows the input to be shown", () => {
    setShouldHideTvBroSaveInput(false)

    expect(getShouldHideTvBroSaveInput()).toBe(false)
  })

  it("notifies subscribers when the preference changes", () => {
    const listener = vi.fn()
    window.addEventListener(
      "lynvo:tvbro-save-input-preference-changed",
      listener
    )

    setShouldHideTvBroSaveInput(true)

    expect(listener).toHaveBeenCalledOnce()
    window.removeEventListener(
      "lynvo:tvbro-save-input-preference-changed",
      listener
    )
  })

  it("only hides the input in TVBro when the preference is enabled", () => {
    expect(shouldHideSaveInput(true, true)).toBe(true)
    expect(shouldHideSaveInput(true, false)).toBe(false)
    expect(shouldHideSaveInput(false, true)).toBe(false)
  })
})
