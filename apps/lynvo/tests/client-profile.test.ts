import { afterEach, describe, expect, it } from "vitest"
import {
  CLIENT_PROFILE_ATTRIBUTE,
  CLIENT_PROFILE_BOOTSTRAP_SCRIPT,
  getClientProfile,
  TVBRO_ANDROID_TV_PROFILE,
} from "~/lib/client-profile"

afterEach(() => {
  Reflect.deleteProperty(window, "TVBro")
  document.documentElement.removeAttribute(CLIENT_PROFILE_ATTRIBUTE)
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
})
