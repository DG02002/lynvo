import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { PlayerSettings } from "~/features/site/settings/player-settings"
import { PlayerPreferenceProvider } from "~/context/player-preference-context"
import { createMemoryStorage } from "./memory-storage"

const { convexMutationMock, convexQueryMock } = vi.hoisted(() => ({
  convexMutationMock: vi.fn(),
  convexQueryMock: vi.fn(),
}))

vi.mock("convex/react", () => ({
  useMutation: () => convexMutationMock,
  useQuery: convexQueryMock,
}))

describe("Player settings browser data", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("loads Player settings from the native Convex subscription", async () => {
    vi.stubGlobal("localStorage", createMemoryStorage())
    const fetchMock = vi.spyOn(globalThis, "fetch")
    convexQueryMock.mockReturnValue({
      rangeSupportedPlayerId: "mpv",
      rangeUnsupportedPlayerId: "mx",
      revision: 1,
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
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
