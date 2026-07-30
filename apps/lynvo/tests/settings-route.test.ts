import { describe, expect, it } from "vitest"
import {
  getLegacySettingsPath,
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

  it("migrates legacy hash URLs to canonical paths", () => {
    expect(getLegacySettingsPath("#plugins")).toBe("/settings/plugins")
    expect(getLegacySettingsPath("#security/active-sessions")).toBe(
      "/settings/security/active-sessions"
    )
    expect(getLegacySettingsPath("")).toBeNull()
  })
})
