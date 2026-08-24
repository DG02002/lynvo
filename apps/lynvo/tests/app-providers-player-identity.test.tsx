import { render, screen } from "@testing-library/react"
import {
  PlayerPreferenceProvider,
  usePlayerPreferenceIdentity,
} from "~/context/player-preference-context"
import { toProviderUser } from "~/root/provider-user"

const IdentityProbe = () => (
  <output data-testid="player-identity">
    {usePlayerPreferenceIdentity() ?? "signed-out"}
  </output>
)

describe("AppProviders player identity", () => {
  it("reactively carries committed account transitions through the provider", () => {
    const firstUser = toProviderUser({ sub: "user-a" })
    const view = render(
      <PlayerPreferenceProvider userId={firstUser?.id}>
        <IdentityProbe />
      </PlayerPreferenceProvider>
    )
    expect(screen.getByTestId("player-identity")).toHaveTextContent("user-a")

    const secondUser = toProviderUser({ sub: "user-b" })
    view.rerender(
      <PlayerPreferenceProvider userId={secondUser?.id}>
        <IdentityProbe />
      </PlayerPreferenceProvider>
    )
    expect(screen.getByTestId("player-identity")).toHaveTextContent("user-b")

    view.rerender(
      <PlayerPreferenceProvider userId={toProviderUser(null)?.id}>
        <IdentityProbe />
      </PlayerPreferenceProvider>
    )
    expect(screen.getByTestId("player-identity")).toHaveTextContent(
      "signed-out"
    )
  })
})
