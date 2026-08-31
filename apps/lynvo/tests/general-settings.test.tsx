import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ThemeProvider } from "next-themes"
import { createMemoryRouter, RouterProvider } from "react-router"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { GeneralSettings } from "~/features/site/settings/general-settings"
import { AUTO_SAVE_LINKS_STORAGE_KEY } from "~/features/site/settings/auto-save-links-preference"
import { createMemoryStorage } from "./memory-storage"

beforeEach(() => {
  vi.stubGlobal("localStorage", createMemoryStorage())
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
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

describe("GeneralSettings", () => {
  it("shows auto-save as an editable setting that is on by default", async () => {
    const router = createMemoryRouter(
      [
        {
          id: "root",
          loader: () => ({ mediaView: "hybrid" }),
          children: [{ path: "/", element: <GeneralSettings /> }],
        },
      ],
      { initialEntries: ["/"] }
    )
    render(
      <ThemeProvider attribute="class">
        <RouterProvider router={router} />
      </ThemeProvider>
    )

    const autoSaveSwitch = await screen.findByRole("switch", {
      name: "Save all links automatically",
    })

    expect(autoSaveSwitch).toBeChecked()
    expect(autoSaveSwitch).not.toHaveAttribute("aria-disabled", "true")

    fireEvent.click(autoSaveSwitch)

    await waitFor(() => {
      expect(autoSaveSwitch).not.toBeChecked()
      expect(localStorage.getItem(AUTO_SAVE_LINKS_STORAGE_KEY)).toBe("false")
    })
  })
})
