import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  CLIENT_PROFILE_ATTRIBUTE,
  CLIENT_PROFILE_BOOTSTRAP_SCRIPT,
  createClientProfileBootstrapScript,
  getCurrentClientProfile,
  getClientProfile,
  getViewTransitionEnabled,
  TVBRO_ANDROID_TV_PROFILE,
} from "~/lib/client-profile"
import { DEVELOPMENT_TVBRO_UI_STORAGE_KEY } from "~/lib/development-settings"
import { createMemoryStorage } from "./memory-storage"

const defaultUserAgent = navigator.userAgent

const setUserAgent = (userAgent: string) => {
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: userAgent,
  })
}

beforeEach(() => {
  vi.stubGlobal("localStorage", createMemoryStorage())
})

afterEach(() => {
  Reflect.deleteProperty(window, "TVBro")
  Object.defineProperty(navigator, "userAgent", {
    configurable: true,
    value: defaultUserAgent,
  })
  document.documentElement.removeAttribute(CLIENT_PROFILE_ATTRIBUTE)
  vi.unstubAllGlobals()
})

describe("client profile", () => {
  it("identifies TV Bro from its verified WebView bridge", () => {
    expect(getClientProfile({ hasTvBroBridge: true })).toBe(
      TVBRO_ANDROID_TV_PROFILE
    )
  })

  it("does not classify a browser without the TV Bro bridge", () => {
    expect(getClientProfile({ hasTvBroBridge: false })).toBeNull()
  })

  it("uses the development TV Bro override without a native bridge", () => {
    localStorage.setItem(DEVELOPMENT_TVBRO_UI_STORAGE_KEY, "true")

    expect(getCurrentClientProfile()).toBe(TVBRO_ANDROID_TV_PROFILE)
  })

  it("uses the development TV Bro user agent without a native bridge", () => {
    setUserAgent("TV Bro/1.0 Mozilla/5.0 (Linux; Android 11; Android TV)")

    expect(getCurrentClientProfile()).toBe(TVBRO_ANDROID_TV_PROFILE)
  })

  it("disables view transitions for TV Bro only", () => {
    expect(getViewTransitionEnabled()).toBe(true)

    Object.defineProperty(window, "TVBro", {
      configurable: true,
      value: {},
    })

    expect(getViewTransitionEnabled()).toBe(false)
  })
})

describe("client profile bootstrap", () => {
  it("marks the document before hydration for the matching TV Bro profile", () => {
    Object.defineProperty(window, "TVBro", {
      configurable: true,
      value: {},
    })
    document.documentElement.removeAttribute(CLIENT_PROFILE_ATTRIBUTE)

    window.eval(CLIENT_PROFILE_BOOTSTRAP_SCRIPT)

    expect(document.documentElement.dataset.lynvoClientProfile).toBe(
      TVBRO_ANDROID_TV_PROFILE
    )
  })

  it("marks the document before hydration for the development override", () => {
    localStorage.setItem(DEVELOPMENT_TVBRO_UI_STORAGE_KEY, "true")
    document.documentElement.removeAttribute(CLIENT_PROFILE_ATTRIBUTE)

    window.eval(CLIENT_PROFILE_BOOTSTRAP_SCRIPT)

    expect(document.documentElement.dataset.lynvoClientProfile).toBe(
      TVBRO_ANDROID_TV_PROFILE
    )
  })

  it("marks the document before hydration for the development TV Bro user agent", () => {
    setUserAgent("TV Bro/1.0 Mozilla/5.0 (Linux; Android 11; Android TV)")
    document.documentElement.removeAttribute(CLIENT_PROFILE_ATTRIBUTE)

    window.eval(CLIENT_PROFILE_BOOTSTRAP_SCRIPT)

    expect(document.documentElement.dataset.lynvoClientProfile).toBe(
      TVBRO_ANDROID_TV_PROFILE
    )
  })

  it("ignores the development override in the production bootstrap", () => {
    localStorage.setItem(DEVELOPMENT_TVBRO_UI_STORAGE_KEY, "true")
    document.documentElement.removeAttribute(CLIENT_PROFILE_ATTRIBUTE)

    window.eval(createClientProfileBootstrapScript(false))

    expect(document.documentElement.dataset.lynvoClientProfile).toBeUndefined()
  })

  it("ignores the development TV Bro user agent in the production bootstrap", () => {
    setUserAgent("TV Bro/1.0 Mozilla/5.0 (Linux; Android 11; Android TV)")
    document.documentElement.removeAttribute(CLIENT_PROFILE_ATTRIBUTE)

    window.eval(createClientProfileBootstrapScript(false))

    expect(document.documentElement.dataset.lynvoClientProfile).toBeUndefined()
  })
})
