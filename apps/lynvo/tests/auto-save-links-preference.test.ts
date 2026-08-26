import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  AUTO_SAVE_LINKS_PREFERENCE_EVENT,
  AUTO_SAVE_LINKS_STORAGE_KEY,
  getShouldAutoSaveAllLinks,
  setShouldAutoSaveAllLinks,
} from "~/features/site/settings/auto-save-links-preference"
import { createMemoryStorage } from "./memory-storage"

beforeEach(() => {
  vi.stubGlobal("localStorage", createMemoryStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("Auto-save links preference", () => {
  it("is disabled by default", () => {
    expect(getShouldAutoSaveAllLinks()).toBe(false)
  })

  it("persists and broadcasts changes", () => {
    const listener = vi.fn()
    window.addEventListener(AUTO_SAVE_LINKS_PREFERENCE_EVENT, listener)

    setShouldAutoSaveAllLinks(true)

    expect(getShouldAutoSaveAllLinks()).toBe(true)
    expect(localStorage.getItem(AUTO_SAVE_LINKS_STORAGE_KEY)).toBe("true")
    expect(listener).toHaveBeenCalledOnce()

    setShouldAutoSaveAllLinks(false)

    expect(getShouldAutoSaveAllLinks()).toBe(false)
    expect(localStorage.getItem(AUTO_SAVE_LINKS_STORAGE_KEY)).toBe("false")
    expect(listener).toHaveBeenCalledTimes(2)

    window.removeEventListener(AUTO_SAVE_LINKS_PREFERENCE_EVENT, listener)
  })
})
