import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"

import { Footer } from "../app/components/Footer"

const renderFooter = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Footer />
    </MemoryRouter>
  )

describe("Footer", () => {
  it.each([
    "/save",
    "/save/",
    "/settings",
    "/settings/plugins",
    "/docs/android-tv",
  ])("shows only the copyright footer on %s", (path) => {
    renderFooter(path)

    expect(screen.getByText("Lynvo © 2026")).toBeInTheDocument()
    expect(screen.queryByRole("heading", { name: "Support" })).toBeNull()
    expect(screen.queryByRole("heading", { name: "Company" })).toBeNull()
    expect(screen.queryByRole("heading", { name: "Learn" })).toBeNull()
    expect(
      screen.queryByRole("heading", { name: "Terms and policies" })
    ).toBeNull()
  })

  it.each(["/", "/about", "/docs", "/docs/"])(
    "shows the full footer on %s",
    (path) => {
      renderFooter(path)

      expect(screen.getByText("Lynvo © 2026")).toBeInTheDocument()
      expect(
        screen.getByRole("heading", { name: "Support" })
      ).toBeInTheDocument()
      expect(
        screen.getByRole("heading", { name: "Terms and policies" })
      ).toBeInTheDocument()
    }
  )
})
