import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DevelopmentSettings } from "~/features/site/settings/development-settings"
import {
  DEVELOPMENT_FREEZE_USAGE_COOKIE_NAME,
  DEVELOPMENT_FREEZE_USAGE_BOOTSTRAP_SCRIPT,
  DEVELOPMENT_FREEZE_USAGE_STORAGE_KEY,
  DEVELOPMENT_TVBRO_UI_STORAGE_KEY,
  getDevelopmentFreezeUsageEnabled,
  isDevelopmentFreezeUsageEnabled,
} from "~/lib/development-settings"
import { CLIENT_PROFILE_ATTRIBUTE } from "~/lib/client-profile"
import { createMemoryStorage } from "./memory-storage"

beforeEach(() => {
  vi.stubGlobal("localStorage", createMemoryStorage())
  document.documentElement.removeAttribute(CLIENT_PROFILE_ATTRIBUTE)
})

afterEach(() => {
  vi.unstubAllGlobals()
  document.documentElement.removeAttribute(CLIENT_PROFILE_ATTRIBUTE)
})

describe("DevelopmentSettings", () => {
  it("updates the TV Bro preview and usage freeze settings locally", async () => {
    render(<DevelopmentSettings />)

    const tvBroSwitch = screen.getByRole("switch", {
      name: "Use TV Bro-specific UI",
    })
    const freezeUsageSwitch = screen.getByRole("switch", {
      name: "Freeze usage",
    })

    expect(tvBroSwitch).not.toBeChecked()
    expect(freezeUsageSwitch).toBeChecked()
    expect(getDevelopmentFreezeUsageEnabled()).toBe(true)
    expect(
      isDevelopmentFreezeUsageEnabled(
        new Request("http://localhost:5173/api/extract")
      )
    ).toBe(true)

    fireEvent.click(tvBroSwitch)
    await waitFor(() => {
      expect(tvBroSwitch).toBeChecked()
      expect(localStorage.getItem(DEVELOPMENT_TVBRO_UI_STORAGE_KEY)).toBe(
        "true"
      )
      expect(
        document.documentElement.getAttribute(CLIENT_PROFILE_ATTRIBUTE)
      ).toBe("tvbro-android-tv")
    })

    fireEvent.click(freezeUsageSwitch)
    await waitFor(() => {
      expect(freezeUsageSwitch).not.toBeChecked()
      expect(localStorage.getItem(DEVELOPMENT_FREEZE_USAGE_STORAGE_KEY)).toBe(
        "false"
      )
      expect(getDevelopmentFreezeUsageEnabled()).toBe(false)
    })

    expect(
      isDevelopmentFreezeUsageEnabled(
        new Request("http://localhost:5173/api/extract", {
          headers: {
            Cookie: `${DEVELOPMENT_FREEZE_USAGE_COOKIE_NAME}=false`,
          },
        })
      )
    ).toBe(false)

    fireEvent.click(freezeUsageSwitch)
    await waitFor(() => {
      expect(freezeUsageSwitch).toBeChecked()
      expect(localStorage.getItem(DEVELOPMENT_FREEZE_USAGE_STORAGE_KEY)).toBe(
        "true"
      )
      expect(getDevelopmentFreezeUsageEnabled()).toBe(true)
    })

    expect(
      isDevelopmentFreezeUsageEnabled(
        new Request("http://localhost:5173/api/extract", {
          headers: {
            Cookie: `${DEVELOPMENT_FREEZE_USAGE_COOKIE_NAME}=true`,
          },
        })
      )
    ).toBe(true)
  })
})

describe("development freeze usage bootstrap", () => {
  it("syncs the explicit local preference to the cookie", () => {
    localStorage.setItem(DEVELOPMENT_FREEZE_USAGE_STORAGE_KEY, "false")
    document.cookie = `${DEVELOPMENT_FREEZE_USAGE_COOKIE_NAME}=true`

    window.eval(DEVELOPMENT_FREEZE_USAGE_BOOTSTRAP_SCRIPT)

    expect(document.cookie).toContain(
      `${DEVELOPMENT_FREEZE_USAGE_COOKIE_NAME}=false`
    )
  })

  it("defaults a missing local preference to enabled", () => {
    document.cookie = `${DEVELOPMENT_FREEZE_USAGE_COOKIE_NAME}=false`

    window.eval(DEVELOPMENT_FREEZE_USAGE_BOOTSTRAP_SCRIPT)

    expect(document.cookie).toContain(
      `${DEVELOPMENT_FREEZE_USAGE_COOKIE_NAME}=true`
    )
  })
})
