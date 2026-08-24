import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { SaveDateGroupHeading } from "~/components/save-list/save-date-group-heading"

describe("SaveDateGroupHeading", () => {
  it("renders the shared library heading scale", () => {
    render(<SaveDateGroupHeading label="Today" />)

    expect(
      screen.getByRole("heading", { level: 2, name: "Today" })
    ).toHaveClass("font-heading", "text-2xl", "font-bold", "tracking-tight")
  })

  it("supports an anchor id and extra classes", () => {
    render(
      <SaveDateGroupHeading
        label="Older"
        id="save-section-older"
        className="px-2"
      />
    )

    const heading = screen.getByRole("heading", { name: "Older" })
    expect(heading).toHaveAttribute("id", "save-section-older")
    expect(heading).toHaveClass("px-2")
  })
})
