import { fireEvent, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"

import { CookieConsent } from "~/components/cookie-consent"
import { COOKIE_PREFERENCES_STORAGE_KEY } from "~/lib/constants"

const storedValues = new Map<string, string>()

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: {
    getItem: (key: string) => storedValues.get(key) ?? null,
    setItem: (key: string, value: string) => storedValues.set(key, value),
  },
})

describe("CookieConsent", () => {
  beforeEach(() => {
    storedValues.delete(COOKIE_PREFERENCES_STORAGE_KEY)
  })

  it("uses theme-aware surfaces and colors for the banner and preferences dialog", async () => {
    render(
      <MemoryRouter>
        <CookieConsent />
      </MemoryRouter>
    )

    const banner = await screen.findByRole("region", {
      name: "Cookie consent",
    })

    expect(banner).toHaveClass("bg-background/70", "text-foreground")
    expect(banner).not.toHaveClass("bg-zinc-900/85", "text-white")
    expect(banner.className).not.toContain("0_-1px_0")
    expect(screen.getByRole("heading", { name: "We use cookies" })).toHaveClass(
      "font-normal"
    )
    expect(
      screen.getByText(/We use cookies to help this site function/)
    ).toHaveClass("text-xs")
    expect(
      screen.getByText(/We use cookies to help this site function/)
    ).not.toHaveClass("sm:text-sm")

    expect(
      screen.getByRole("button", {
        name: "Accept all",
      })
    ).toHaveClass("bg-secondary", "text-secondary-foreground")

    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Manage Cookies",
      })[0]
    )

    const dialog = await screen.findByRole("dialog")

    expect(dialog).toHaveClass("bg-popover", "text-popover-foreground")
    expect(dialog).not.toHaveClass("bg-black", "text-white")
    expect(screen.getByText("Strictly necessary")).toHaveClass(
      "text-foreground"
    )
  })
})
