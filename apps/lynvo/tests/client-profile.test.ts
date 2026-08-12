import { afterEach, describe, expect, it } from "vitest"
import {
  CLIENT_PROFILE_ATTRIBUTE,
  CLIENT_PROFILE_BOOTSTRAP_SCRIPT,
  getClientProfile,
  LEGACY_TVBRO_MOBILE_USER_AGENT,
  TVBRO_ANDROID_TV_PROFILE,
} from "~/lib/client-profile"

const originalUserAgent = window.navigator.userAgent

afterEach(() => {
  Reflect.deleteProperty(window, "TVBro")
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: originalUserAgent,
  })
  document.documentElement.removeAttribute(CLIENT_PROFILE_ATTRIBUTE)
})

describe("client profile", () => {
  it("identifies the legacy TV Bro Android TV profile", () => {
    expect(
      getClientProfile({
        hasTvBroBridge: true,
        userAgent: LEGACY_TVBRO_MOBILE_USER_AGENT,
      })
    ).toBe(TVBRO_ANDROID_TV_PROFILE)
  })

  it("does not trust the spoofed user agent without the TV Bro bridge", () => {
    expect(
      getClientProfile({
        hasTvBroBridge: false,
        userAgent: LEGACY_TVBRO_MOBILE_USER_AGENT,
      })
    ).toBeNull()
  })

  it("does not classify other TV Bro user-agent profiles as low power", () => {
    expect(
      getClientProfile({
        hasTvBroBridge: true,
        userAgent:
          "Mozilla/5.0 (Linux; Android 16; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36",
      })
    ).toBeNull()
  })
})

describe("client profile bootstrap", () => {
  it("marks the document before hydration for the matching TV Bro profile", () => {
    Object.defineProperty(window, "TVBro", {
      configurable: true,
      value: {},
    })
    Object.defineProperty(window.navigator, "userAgent", {
      configurable: true,
      value: LEGACY_TVBRO_MOBILE_USER_AGENT,
    })
    document.documentElement.removeAttribute(CLIENT_PROFILE_ATTRIBUTE)

    window.eval(CLIENT_PROFILE_BOOTSTRAP_SCRIPT)

    expect(document.documentElement.dataset.lynvoClientProfile).toBe(
      TVBRO_ANDROID_TV_PROFILE
    )
  })
})
