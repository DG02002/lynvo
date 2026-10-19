import { render, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getPlayerPreferences } from "~/lib/player-utils"
import { AccountSettingsSynchronization } from "~/root/account-settings-synchronization"

import { createMemoryStorage } from "./memory-storage"

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
      <MemoryRouter initialEntries={["/"]}>
        <AccountSettingsSynchronization
          userId="user-one"
          loadPlayerPreferences={cloudPlayerPreferences}
        />
      </MemoryRouter>
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
      <MemoryRouter initialEntries={["/"]}>
        <AccountSettingsSynchronization
          loadPlayerPreferences={cloudPlayerPreferences}
        />
      </MemoryRouter>
    )

    expect(cloudPlayerPreferences).not.toHaveBeenCalled()
    expect(getPlayerPreferences(undefined)).toEqual({
      rangeSupportedPlayerId: "just",
      rangeUnsupportedPlayerId: "vlc",
    })
  })

  it("leaves player preference loading to the player settings route", () => {
    vi.stubGlobal("localStorage", createMemoryStorage())
    const cloudPlayerPreferences = vi.fn()

    render(
      <MemoryRouter initialEntries={["/settings/player"]}>
        <AccountSettingsSynchronization
          userId="user-one"
          loadPlayerPreferences={cloudPlayerPreferences}
        />
      </MemoryRouter>
    )

    expect(cloudPlayerPreferences).not.toHaveBeenCalled()
  })
})
