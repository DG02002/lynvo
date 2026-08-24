import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PlayerSettings } from "~/features/site/settings/player-settings"
import { PlayerPreferenceProvider } from "~/context/player-preference-context"
import { createMemoryStorage } from "./memory-storage"

describe("Player settings browser data", () => {
  beforeEach(() => vi.clearAllMocks())
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
})
