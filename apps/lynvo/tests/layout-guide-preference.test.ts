import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  LAYOUT_GUIDE_PREFERENCE_EVENT,
  LAYOUT_GUIDE_STORAGE_KEY,
  getShouldShowLayoutGuide,
  setShouldShowLayoutGuide,
} from "~/features/site/settings/layout-guide-preference"
import { createMemoryStorage } from "./memory-storage"

beforeEach(() => {
  vi.stubGlobal("localStorage", createMemoryStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("Layout guide preference", () => {
  it("is disabled by default", () => {
    expect(getShouldShowLayoutGuide()).toBe(false)
  })

  it("persists and broadcasts the enabled value", () => {
    const listener = vi.fn()
    window.addEventListener(LAYOUT_GUIDE_PREFERENCE_EVENT, listener)

    setShouldShowLayoutGuide(true)

    expect(getShouldShowLayoutGuide()).toBe(true)
    expect(localStorage.getItem(LAYOUT_GUIDE_STORAGE_KEY)).toBe("true")
    expect(listener).toHaveBeenCalledOnce()

    window.removeEventListener(LAYOUT_GUIDE_PREFERENCE_EVENT, listener)
  })
})
