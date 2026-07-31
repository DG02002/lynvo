import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { describe, expect, it } from "vitest"
import NotFound from "~/features/site/routes/_site.not-found"

describe("not-found page", () => {
  it("provides recovery navigation", () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    )

    expect(screen.getByRole("button", { name: "Go home" })).toHaveAttribute(
      "href",
      "/"
    )
    expect(
      screen.getByRole("button", { name: "Open Help Center" })
    ).toHaveAttribute("href", "/help-center")
  })
})
