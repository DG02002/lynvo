import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  LIBRARY_MEDIA_VIEW_PREFERENCE_EVENT,
  LIBRARY_MEDIA_VIEW_STORAGE_KEY,
  MEDIA_VIEW_COOKIE_NAME,
  getLibraryMediaView,
  getLibraryMediaViewFromCookieHeader,
  setLibraryMediaView,
} from "~/features/site/settings/library-media-view-preference"
import { createMemoryStorage } from "./memory-storage"

beforeEach(() => {
  vi.stubGlobal("localStorage", createMemoryStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("Library media view preference", () => {
  it("defaults to the library view", () => {
    expect(getLibraryMediaView()).toBe("library")
  })

  it("persists the hybrid value without touching account data", () => {
    setLibraryMediaView("hybrid")

    expect(getLibraryMediaView()).toBe("hybrid")
    expect(localStorage.getItem(LIBRARY_MEDIA_VIEW_STORAGE_KEY)).toBe("hybrid")
  })

  it("treats the legacy disabled value as the list view", () => {
    localStorage.setItem(LIBRARY_MEDIA_VIEW_STORAGE_KEY, "false")

    expect(getLibraryMediaView()).toBe("list")
  })

  it("mirrors the preference into the media view cookie", () => {
    setLibraryMediaView("list")
    expect(document.cookie).toContain(`${MEDIA_VIEW_COOKIE_NAME}=list`)

    setLibraryMediaView("hybrid")
    expect(document.cookie).toContain(`${MEDIA_VIEW_COOKIE_NAME}=hybrid`)

    setLibraryMediaView("library")
    expect(document.cookie).toContain(`${MEDIA_VIEW_COOKIE_NAME}=library`)
  })

  it("reads the server-side view from the cookie header", () => {
    expect(
      getLibraryMediaViewFromCookieHeader(`${MEDIA_VIEW_COOKIE_NAME}=list`)
    ).toBe("list")
    expect(
      getLibraryMediaViewFromCookieHeader(`${MEDIA_VIEW_COOKIE_NAME}=hybrid`)
    ).toBe("hybrid")
    expect(
      getLibraryMediaViewFromCookieHeader(`${MEDIA_VIEW_COOKIE_NAME}=library`)
    ).toBe("library")
    expect(
      getLibraryMediaViewFromCookieHeader(`${MEDIA_VIEW_COOKIE_NAME}=junk`)
    ).toBeUndefined()
    expect(getLibraryMediaViewFromCookieHeader(null)).toBeUndefined()
    expect(
      getLibraryMediaViewFromCookieHeader("lynvo-session=abc")
    ).toBeUndefined()
  })

  it("notifies subscribers when the preference changes", () => {
    const listener = vi.fn()
    window.addEventListener(LIBRARY_MEDIA_VIEW_PREFERENCE_EVENT, listener)

    setLibraryMediaView("hybrid")

    expect(listener).toHaveBeenCalledOnce()
    window.removeEventListener(LIBRARY_MEDIA_VIEW_PREFERENCE_EVENT, listener)
  })
})
