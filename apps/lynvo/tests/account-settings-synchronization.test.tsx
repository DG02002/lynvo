import { render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getPlayerPreferences } from "~/lib/player-utils"
import { createMemoryStorage } from "./memory-storage"

import { AccountSettingsSynchronization } from "~/root/account-settings-synchronization"

describe("account settings synchronization", () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it("reconciles player preferences from the cloud snapshot", async () => {
    vi.stubGlobal("localStorage", createMemoryStorage())
    const cloudPlayerPreferences = vi.fn().mockResolvedValue({
      rangeSupportedPlayerId: "mpv",
      rangeUnsupportedPlayerId: "mx",
    })

    render(
      <AccountSettingsSynchronization
        userId="user-one"
        loadPlayerPreferences={cloudPlayerPreferences}
      />
    )

    await waitFor(() =>
      expect(getPlayerPreferences("user-one")).toEqual({
        rangeSupportedPlayerId: "mpv",
        rangeUnsupportedPlayerId: "mx",
      })
    )
  })

  it("preserves defaults when signed out", () => {
    vi.stubGlobal("localStorage", createMemoryStorage())
    const cloudPlayerPreferences = vi.fn()

    render(
      <AccountSettingsSynchronization
        loadPlayerPreferences={cloudPlayerPreferences}
      />
    )

    expect(cloudPlayerPreferences).not.toHaveBeenCalled()
    expect(getPlayerPreferences(undefined)).toEqual({
      rangeSupportedPlayerId: "just",
      rangeUnsupportedPlayerId: "vlc",
    })
  })
})
