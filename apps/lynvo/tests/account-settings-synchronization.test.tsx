import { render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getPlayerPreferences } from "~/lib/player-utils"
import { createMemoryStorage } from "./memory-storage"

const { cloudPlayerPreferences } = vi.hoisted(() => ({
  cloudPlayerPreferences: vi.fn(),
}))

vi.mock("~/lib/effect/api/client", async () => {
  const { Effect } = await import("effect")
  return {
    client: {
      settings: {
        getPlayerPreferences: () =>
          Effect.tryPromise(() => cloudPlayerPreferences()),
        updatePlayerPreferences: () => Effect.succeed({ success: true }),
      },
    },
  }
})

import { AccountSettingsSynchronization } from "~/root/account-settings-synchronization"

describe("account settings synchronization", () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => vi.unstubAllGlobals())

  it("reconciles player preferences from the cloud snapshot", async () => {
    vi.stubGlobal("localStorage", createMemoryStorage())
    cloudPlayerPreferences.mockResolvedValue({
      rangeSupportedPlayerId: "mpv",
      rangeUnsupportedPlayerId: "mx",
    })

    render(<AccountSettingsSynchronization userId="user-one" />)

    await waitFor(() =>
      expect(getPlayerPreferences("user-one")).toEqual({
        rangeSupportedPlayerId: "mpv",
        rangeUnsupportedPlayerId: "mx",
      })
    )
  })

  it("preserves defaults when signed out", () => {
    vi.stubGlobal("localStorage", createMemoryStorage())

    render(<AccountSettingsSynchronization />)

    expect(cloudPlayerPreferences).not.toHaveBeenCalled()
    expect(getPlayerPreferences(undefined)).toEqual({
      rangeSupportedPlayerId: "just",
      rangeUnsupportedPlayerId: "vlc",
    })
  })
})
