import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, waitFor } from "@testing-library/react"
import { vi } from "vitest"
import { getPlayerPreferences } from "~/lib/player-utils"
import { PlayerPreferenceProvider } from "~/context/player-preference-context"
import { createMemoryStorage } from "./memory-storage"

const { subscribe } = vi.hoisted(() => ({ subscribe: vi.fn(() => vi.fn()) }))

vi.mock("~/context/RealtimeContext", () => ({
  useRealtime: () => ({
    status: "connected",
    connectionGeneration: 1,
    subscribe,
  }),
}))

import { AccountSettingsSynchronization } from "~/root/account-settings-synchronization"

describe("account settings synchronization", () => {
  beforeEach(() => subscribe.mockClear())
  afterEach(() => vi.unstubAllGlobals())

  it("reconciles player preferences outside the Settings route", async () => {
    vi.stubGlobal("localStorage", createMemoryStorage())
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          rangeSupportedPlayerId: "mpv",
          rangeUnsupportedPlayerId: "mx",
        })
      )
    )
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <PlayerPreferenceProvider userId="user-one">
          <AccountSettingsSynchronization userId="user-one" />
        </PlayerPreferenceProvider>
      </QueryClientProvider>
    )

    await waitFor(() =>
      expect(getPlayerPreferences("user-one")).toEqual({
        rangeSupportedPlayerId: "mpv",
        rangeUnsupportedPlayerId: "mx",
      })
    )
    expect(subscribe).toHaveBeenCalled()
  })

  it("does not carry account A preferences into account B", async () => {
    vi.stubGlobal("localStorage", createMemoryStorage())
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          rangeSupportedPlayerId: "mpv",
          rangeUnsupportedPlayerId: "mx",
        })
      )
    )
    const first = render(
      <QueryClientProvider client={queryClient}>
        <PlayerPreferenceProvider userId="user-a">
          <AccountSettingsSynchronization userId="user-a" />
        </PlayerPreferenceProvider>
      </QueryClientProvider>
    )
    await waitFor(() =>
      expect(getPlayerPreferences("user-a")).toEqual({
        rangeSupportedPlayerId: "mpv",
        rangeUnsupportedPlayerId: "mx",
      })
    )
    first.unmount()
    queryClient.clear()

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({}))
    )
    render(
      <QueryClientProvider client={queryClient}>
        <PlayerPreferenceProvider userId="user-b">
          <AccountSettingsSynchronization userId="user-b" />
        </PlayerPreferenceProvider>
      </QueryClientProvider>
    )
    await waitFor(() =>
      expect(getPlayerPreferences("user-b")).toEqual({
        rangeSupportedPlayerId: "just",
        rangeUnsupportedPlayerId: "vlc",
      })
    )
  })
})
