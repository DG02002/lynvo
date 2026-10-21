import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PlayerPreferenceProvider } from "~/context/player-preference-context"
import { PlayerSettings } from "~/features/site/settings/player-settings"
import { useRangePlayerPreferences } from "~/features/site/settings/use-range-player-preferences"
import { clearAsyncResourceCache } from "~/hooks/use-async-resource"
import { getPlayerPreferences, type PlayerId } from "~/lib/player-utils"
import { AccountSettingsSynchronization } from "~/root/account-settings-synchronization"

import { createMemoryStorage } from "./memory-storage"

describe("Player settings browser data", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearAsyncResourceCache()
  })
  afterEach(() => vi.unstubAllGlobals())

  it("loads Player settings from the cloud snapshot", async () => {
    vi.stubGlobal("localStorage", createMemoryStorage())
    const cloudPlayerPreferences = vi.fn().mockResolvedValue({
      rangeSupportedPlayerId: "mpv",
      rangeUnsupportedPlayerId: "mx",
    })

    render(
      <PlayerPreferenceProvider userId="test-user">
        <PlayerSettings
          loadPlayerPreferences={cloudPlayerPreferences}
          savePlayerPreferences={vi.fn().mockResolvedValue(undefined)}
        />
      </PlayerPreferenceProvider>
    )

    const playerSelectors = await screen.findAllByRole("combobox")
    await waitFor(() => {
      expect(playerSelectors[0]).toHaveTextContent("mpv")
      expect(playerSelectors[1]).toHaveTextContent("MX Player")
    })
  })

  it("fetches once on the player route and reloads after a saved change", async () => {
    vi.stubGlobal("localStorage", createMemoryStorage())
    const loadPlayerPreferences = vi.fn().mockResolvedValue({
      rangeSupportedPlayerId: "mpv",
      rangeUnsupportedPlayerId: "mx",
    })
    const savePlayerPreferences = vi.fn().mockResolvedValue(undefined)

    render(
      <MemoryRouter initialEntries={["/settings/player"]}>
        <PlayerPreferenceProvider userId="test-user">
          <AccountSettingsSynchronization
            userId="test-user"
            loadPlayerPreferences={loadPlayerPreferences}
          />
          <PlayerSettings
            loadPlayerPreferences={loadPlayerPreferences}
            savePlayerPreferences={savePlayerPreferences}
          />
        </PlayerPreferenceProvider>
      </MemoryRouter>
    )

    const playerSelectors = await screen.findAllByRole("combobox")
    await waitFor(() => {
      expect(playerSelectors[0]).toHaveTextContent("mpv")
      expect(playerSelectors[1]).toHaveTextContent("MX Player")
    })
    expect(loadPlayerPreferences).toHaveBeenCalledOnce()

    fireEvent.click(playerSelectors[0])
    const justPlayerOption = await screen.findByRole("option", {
      name: "Just (Video) Player",
    })
    fireEvent.pointerDown(justPlayerOption, {
      button: 0,
      isPrimary: true,
      pointerType: "mouse",
    })
    fireEvent.click(justPlayerOption)

    await waitFor(() =>
      expect(savePlayerPreferences).toHaveBeenCalledWith({
        rangeSupportedPlayerId: "just",
      })
    )
    await waitFor(() => expect(loadPlayerPreferences).toHaveBeenCalledTimes(2))
  })

  it("keeps a local preference changed before a stale cloud response arrives", async () => {
    vi.stubGlobal("localStorage", createMemoryStorage())
    type CloudPreferences = {
      rangeSupportedPlayerId?: PlayerId
      rangeUnsupportedPlayerId?: PlayerId
    }
    const updateCloudPreferences = vi.fn().mockResolvedValue(undefined)
    const { result, rerender } = renderHook(
      ({
        cloudPreferences,
      }: {
        cloudPreferences: CloudPreferences | undefined
      }) =>
        useRangePlayerPreferences({
          cloudPreferences,
          playerPreferenceIdentity: "test-user",
          updateCloudPreferences,
        }),
      { initialProps: { cloudPreferences: undefined } }
    )

    await act(async () => {
      result.current.handleRangeSupportedChange("mpv")
    })
    rerender({
      cloudPreferences: {
        rangeSupportedPlayerId: "mx",
        rangeUnsupportedPlayerId: "just",
      },
    })

    await waitFor(() => {
      expect(result.current.rangeSupportedPlayerId).toBe("mpv")
      expect(result.current.rangeUnsupportedPlayerId).toBe("just")
    })
    expect(getPlayerPreferences("test-user")).toEqual({
      rangeSupportedPlayerId: "mpv",
      rangeUnsupportedPlayerId: "just",
    })
  })
})
