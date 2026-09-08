import { describe, expect, it } from "vitest"
import { loader as developmentRedirectLoader } from "~/features/site/routes/_site.settings.development-redirect"
import {
  getSettingsPath,
  parseSettingsRoute,
} from "~/features/site/settings/settings-route"

describe("settings routes", () => {
  it("resolves the requested tab before rendering", () => {
    expect(parseSettingsRoute("plugins")).toEqual({
      activeTab: "plugins",
      showActiveSessions: false,
    })
    expect(parseSettingsRoute("security", "active-sessions")).toEqual({
      activeTab: "security",
      showActiveSessions: true,
    })
  })

  it("uses General for the settings index", () => {
    expect(parseSettingsRoute()).toEqual({
      activeTab: "general",
      showActiveSessions: false,
    })
  })

  it("rejects unknown sections and subviews", () => {
    expect(parseSettingsRoute("unknown")).toBeNull()
    expect(parseSettingsRoute("plugins", "active-sessions")).toBeNull()
  })

  it("builds canonical path-based settings URLs", () => {
    expect(getSettingsPath("plugins")).toBe("/settings/plugins")
    expect(getSettingsPath("security", "active-sessions")).toBe(
      "/settings/security/active-sessions"
    )
  })

  it("redirects the public development URL to General", () => {
    const response = developmentRedirectLoader()

    expect(response.status).toBe(302)
    expect(response.headers.get("Location")).toBe("/settings/general")
  })
})
