import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const appCss = readFileSync(resolve(process.cwd(), "app/app.css"), "utf8")

describe("TVBro auth layout", () => {
  it("scopes the landscape auth layout to the TVBro client profile", () => {
    expect(appCss).toContain(
      '@media (orientation: landscape) {\n  html[data-lynvo-client-profile="tvbro-android-tv"]'
    )
    expect(appCss).toContain(
      'html[data-lynvo-client-profile="tvbro-android-tv"] [data-device-sign-in-page],\n  html[data-lynvo-client-profile="tvbro-android-tv"] [data-auth-form-page]'
    )
    expect(appCss).toContain(
      'html[data-lynvo-client-profile="tvbro-android-tv"] [data-device-login-state]'
    )
  })
})
