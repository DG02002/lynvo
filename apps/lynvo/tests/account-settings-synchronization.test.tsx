import { render, waitFor } from "@testing-library/react"
import { vi } from "vitest"
import { getPlayerPreferences } from "~/lib/player-utils"
import { createMemoryStorage } from "./memory-storage"

const { convexQueryMock } = vi.hoisted(() => ({ convexQueryMock: vi.fn() }))

vi.mock("convex/react", () => ({ useQuery: convexQueryMock }))

import { AccountSettingsSynchronization } from "~/root/account-settings-synchronization"

describe("account settings synchronization", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("reconciles player preferences from the native Convex subscription", async () => {
    vi.stubGlobal("localStorage", createMemoryStorage())
    convexQueryMock.mockReturnValue({
      rangeSupportedPlayerId: "mpv",
      rangeUnsupportedPlayerId: "mx",
      revision: 1,
    })

    render(<AccountSettingsSynchronization userId="user-one" />)

    await waitFor(() =>
      expect(getPlayerPreferences("user-one")).toEqual({
        rangeSupportedPlayerId: "mpv",
        rangeUnsupportedPlayerId: "mx",
      })
    )
  })

  it("skips the subscription and preserves defaults when signed out", () => {
    vi.stubGlobal("localStorage", createMemoryStorage())
    convexQueryMock.mockReturnValue(undefined)

    render(<AccountSettingsSynchronization />)

    expect(convexQueryMock.mock.calls.at(-1)?.[1]).toBe("skip")
    expect(getPlayerPreferences(undefined)).toEqual({
      rangeSupportedPlayerId: "just",
      rangeUnsupportedPlayerId: "vlc",
    })
  })
})
