import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  LIBRARY_MEDIA_VIEW_PREFERENCE_EVENT,
  LIBRARY_MEDIA_VIEW_STORAGE_KEY,
  MEDIA_VIEW_COOKIE_NAME,
  getMediaViewIsLibraryFromCookieHeader,
  getShouldUseLibraryMediaView,
  setShouldUseLibraryMediaView,
} from "~/features/site/settings/library-media-view-preference"
import { createMemoryStorage } from "./memory-storage"

beforeEach(() => {
  vi.stubGlobal("localStorage", createMemoryStorage())
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("Library media view preference", () => {
  it("is enabled by default", () => {
    expect(getShouldUseLibraryMediaView()).toBe(true)
  })

  it("persists the disabled value without touching account data", () => {
    setShouldUseLibraryMediaView(false)

    expect(getShouldUseLibraryMediaView()).toBe(false)
    expect(localStorage.getItem(LIBRARY_MEDIA_VIEW_STORAGE_KEY)).toBe("false")
  })

  it("mirrors the preference into the media view cookie", () => {
    setShouldUseLibraryMediaView(false)
    expect(document.cookie).toContain(`${MEDIA_VIEW_COOKIE_NAME}=list`)

    setShouldUseLibraryMediaView(true)
    expect(document.cookie).toContain(`${MEDIA_VIEW_COOKIE_NAME}=library`)
  })

  it("reads the server-side view from the cookie header", () => {
    expect(
      getMediaViewIsLibraryFromCookieHeader(`${MEDIA_VIEW_COOKIE_NAME}=list`)
    ).toBe(false)
    expect(
      getMediaViewIsLibraryFromCookieHeader(`${MEDIA_VIEW_COOKIE_NAME}=library`)
    ).toBe(true)
    expect(
      getMediaViewIsLibraryFromCookieHeader(`${MEDIA_VIEW_COOKIE_NAME}=junk`)
    ).toBeUndefined()
    expect(getMediaViewIsLibraryFromCookieHeader(null)).toBeUndefined()
    expect(
      getMediaViewIsLibraryFromCookieHeader("lynvo-session=abc")
    ).toBeUndefined()
  })

  it("notifies subscribers when the preference changes", () => {
    const listener = vi.fn()
    window.addEventListener(LIBRARY_MEDIA_VIEW_PREFERENCE_EVENT, listener)

    setShouldUseLibraryMediaView(false)

    expect(listener).toHaveBeenCalledOnce()
    window.removeEventListener(LIBRARY_MEDIA_VIEW_PREFERENCE_EVENT, listener)
  })
})
