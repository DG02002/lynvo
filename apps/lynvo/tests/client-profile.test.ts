import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  CLIENT_PROFILE_ATTRIBUTE,
  CLIENT_PROFILE_BOOTSTRAP_SCRIPT,
  getCurrentClientProfile,
  getClientProfile,
  TVBRO_ANDROID_TV_PROFILE,
} from "~/lib/client-profile"
import { DEVELOPMENT_TVBRO_UI_STORAGE_KEY } from "~/lib/development-settings"
import { createMemoryStorage } from "./memory-storage"

beforeEach(() => {
  vi.stubGlobal("localStorage", createMemoryStorage())
})

afterEach(() => {
  Reflect.deleteProperty(window, "TVBro")
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
})
