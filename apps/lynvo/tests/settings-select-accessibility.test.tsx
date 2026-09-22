import { ThemeProvider } from "next-themes"
import { renderToString } from "react-dom/server"
import { createMemoryRouter, RouterProvider } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PlayerPreferenceProvider } from "~/context/player-preference-context"
import { GeneralSettings } from "~/features/site/settings/general-settings"
import { PlayerSettings } from "~/features/site/settings/player-settings"

const getComboboxes = (markup: string) => {
  const container = document.createElement("div")
  container.innerHTML = markup
  return [...container.querySelectorAll('[role="combobox"]')]
}

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
    const [appearanceSelect] = getComboboxes(renderGeneralSettings())

    expect(appearanceSelect).toHaveAccessibleName("Appearance")
  })

  it("gives Player settings selects accessible names in SSR output", () => {
    const playerSelects = getComboboxes(
      renderToString(
        <PlayerPreferenceProvider>
          <PlayerSettings />
        </PlayerPreferenceProvider>
      )
    )

    expect(playerSelects).toHaveLength(2)
    expect(playerSelects[0]).toHaveAccessibleName(
      "Links with HTTP byte-range support"
    )
    expect(playerSelects[1]).toHaveAccessibleName(
      "Links without HTTP byte-range support"
    )
  })
})
