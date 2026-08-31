import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  MEDIA_VIEW_PREFERENCE_EVENT,
  MEDIA_VIEW_STORAGE_KEY,
  MEDIA_VIEW_COOKIE_NAME,
  getMediaView,
  getMediaViewFromCookieHeader,
  setMediaView,
} from "~/features/site/settings/media-view-preference"
import { createMemoryStorage } from "./memory-storage"

beforeEach(() => {
  vi.stubGlobal("localStorage", createMemoryStorage())
})

afterEach(() => {
  Reflect.deleteProperty(window, "TVBro")
  vi.unstubAllGlobals()
})

describe("Media view preference", () => {
  it("defaults to the List view in other browsers", () => {
    expect(getMediaView()).toBe("list")
  })

  it("defaults to the Hybrid view in TV Bro", () => {
    Object.defineProperty(window, "TVBro", {
      configurable: true,
      value: {},
    })

    expect(getMediaView()).toBe("hybrid")
  })

  it("keeps an explicitly selected view in TV Bro", () => {
    Object.defineProperty(window, "TVBro", {
      configurable: true,
      value: {},
    })

    setMediaView("list")

    expect(getMediaView()).toBe("list")
  })

  it("persists the selected view without touching account data", () => {
    setMediaView("list")

    expect(getMediaView()).toBe("list")
    expect(localStorage.getItem(MEDIA_VIEW_STORAGE_KEY)).toBe("list")

    setMediaView("hybrid")
    expect(getMediaView()).toBe("hybrid")
  })

  it("mirrors the preference into the media view cookie", () => {
    setMediaView("list")
    expect(document.cookie).toContain(`${MEDIA_VIEW_COOKIE_NAME}=list`)

    setMediaView("hybrid")
    expect(document.cookie).toContain(`${MEDIA_VIEW_COOKIE_NAME}=hybrid`)
  })

  it("reads the server-side view from the cookie header", () => {
    expect(getMediaViewFromCookieHeader(`${MEDIA_VIEW_COOKIE_NAME}=list`)).toBe(
      "list"
    )
    expect(
      getMediaViewFromCookieHeader(`${MEDIA_VIEW_COOKIE_NAME}=hybrid`)
    ).toBe("hybrid")
    expect(
      getMediaViewFromCookieHeader(`${MEDIA_VIEW_COOKIE_NAME}=legacy`)
    ).toBeUndefined()
    expect(
      getMediaViewFromCookieHeader(`${MEDIA_VIEW_COOKIE_NAME}=junk`)
    ).toBeUndefined()
    expect(getMediaViewFromCookieHeader(null)).toBeUndefined()
    expect(getMediaViewFromCookieHeader("lynvo-session=abc")).toBeUndefined()
  })

  it("notifies subscribers when the preference changes", () => {
    const listener = vi.fn()
    window.addEventListener(MEDIA_VIEW_PREFERENCE_EVENT, listener)

    setMediaView("hybrid")

    expect(listener).toHaveBeenCalledOnce()
    window.removeEventListener(MEDIA_VIEW_PREFERENCE_EVENT, listener)
  })
})
