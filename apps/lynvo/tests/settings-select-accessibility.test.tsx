import { within } from "@testing-library/react"
import { ThemeProvider } from "next-themes"
import { renderToString } from "react-dom/server"
import { createMemoryRouter, RouterProvider } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PlayerPreferenceProvider } from "~/context/player-preference-context"
import { GeneralSettings } from "~/features/site/settings/general-settings"
import { PlayerSettings } from "~/features/site/settings/player-settings"
import { StorageSettings } from "~/features/site/settings/storage-settings"

const renderGeneralSettings = () => {
  const router = createMemoryRouter(
    [
      {
        id: "root",
        path: "*",
        element: <GeneralSettings />,
      },
    ],
    { initialEntries: ["/"] }
  )

  return renderToString(
    <ThemeProvider attribute="class">
      <RouterProvider router={router} />
    </ThemeProvider>
  )
}

describe("settings select accessibility", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", () => ({
      matches: false,
      media: "",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("gives the Appearance select an accessible name in SSR output", () => {
    document.body.innerHTML = renderGeneralSettings()
    const appearanceSelect = within(document.body).getByRole("combobox")

    expect(appearanceSelect).toHaveAccessibleName("Appearance")
  })

  it("gives Player settings selects accessible names in SSR output", () => {
    document.body.innerHTML = renderToString(
      <PlayerPreferenceProvider>
        <PlayerSettings />
      </PlayerPreferenceProvider>
    )
    const playerSelects = within(document.body).getAllByRole("combobox")

    expect(playerSelects).toHaveLength(2)
    expect(playerSelects[0]).toHaveAccessibleName(
      "Links with HTTP byte-range support"
    )
    expect(playerSelects[1]).toHaveAccessibleName(
      "Links without HTTP byte-range support"
    )
  })

  it("keeps Storage settings client-gated in SSR output", () => {
    document.body.innerHTML = renderToString(<StorageSettings />)
    const body = within(document.body)

    expect(body.getByText("Loading storage usage…")).toBeVisible()
    expect(body.queryByRole("combobox")).not.toBeInTheDocument()
  })
})
