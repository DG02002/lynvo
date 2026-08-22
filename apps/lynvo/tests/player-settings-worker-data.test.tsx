import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { PlayerSettings } from "~/features/site/settings/player-settings"
import { PlayerPreferenceProvider } from "~/context/player-preference-context"
import { createMemoryStorage } from "./memory-storage"

const { cloudPlayerPreferences, cloudPlayerPreferenceWrites } = vi.hoisted(
  () => ({
    cloudPlayerPreferences: vi.fn(),
    cloudPlayerPreferenceWrites: vi.fn(),
  })
)

vi.mock("~/lib/effect/api/client", async () => {
  const { Effect } = await import("effect")
  return {
    client: {
      settings: {
        getPlayerPreferences: () =>
          Effect.tryPromise(() => cloudPlayerPreferences()),
        updatePlayerPreferences: ({ payload }: { payload: unknown }) =>
          Effect.sync(() => {
            cloudPlayerPreferenceWrites(payload)
            return { success: true }
          }),
      },
    },
  }
})

describe("Player settings browser data", () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it("loads Player settings from the cloud snapshot", async () => {
    vi.stubGlobal("localStorage", createMemoryStorage())
    cloudPlayerPreferences.mockResolvedValue({
      rangeSupportedPlayerId: "mpv",
      rangeUnsupportedPlayerId: "mx",
    })

    render(
      <PlayerPreferenceProvider userId="test-user">
        <PlayerSettings />
      </PlayerPreferenceProvider>
    )

    const playerSelectors = await screen.findAllByRole("combobox")
    await waitFor(() => {
      expect(playerSelectors[0]).toHaveTextContent("MPV")
      expect(playerSelectors[1]).toHaveTextContent("MX Player")
    })
  })
})
