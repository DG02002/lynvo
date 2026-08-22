import { render, screen } from "@testing-library/react"
import { vi } from "vitest"
import { usePlayerPreferenceIdentity } from "~/context/player-preference-context"
import { createMemoryStorage } from "./memory-storage"

vi.mock("next-themes", () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock("~/context/RealtimeContext", () => ({
  RealtimeProvider: ({ children }: { children: React.ReactNode }) => children,
}))
vi.mock("~/context/RemoteControlContext", () => ({
  RemoteControlProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}))
vi.mock("~/components/VersionWatcher", () => ({ VersionWatcher: () => null }))
vi.mock("~/components/player-launch-error-dialog", () => ({
  PlayerLaunchErrorDialog: () => null,
}))
vi.mock("~/components/ui/sonner", () => ({ Toaster: () => null }))
vi.mock("~/root/auth-activity-touch", () => ({ AuthActivityTouch: () => null }))
vi.mock("~/root/theme-cookie-sync", () => ({ ThemeCookieSync: () => null }))
vi.mock("~/root/account-settings-synchronization", () => ({
  AccountSettingsSynchronization: () => null,
}))

import { AppProviders } from "~/root/app-providers"

const IdentityProbe = () => (
  <output data-testid="player-identity">
    {usePlayerPreferenceIdentity() ?? "signed-out"}
  </output>
)

describe("AppProviders player identity", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("reactively carries committed account transitions through the provider", () => {
    vi.stubGlobal("localStorage", createMemoryStorage())
    const view = render(
      <AppProviders buildTime="test" user={{ sub: "user-a" }}>
        <IdentityProbe />
      </AppProviders>
    )
    expect(screen.getByTestId("player-identity")).toHaveTextContent("user-a")

    view.rerender(
      <AppProviders buildTime="test" user={{ sub: "user-b" }}>
        <IdentityProbe />
      </AppProviders>
    )
    expect(screen.getByTestId("player-identity")).toHaveTextContent("user-b")

    view.rerender(
      <AppProviders buildTime="test" user={null}>
        <IdentityProbe />
      </AppProviders>
    )
    expect(screen.getByTestId("player-identity")).toHaveTextContent(
      "signed-out"
    )
  })
})
