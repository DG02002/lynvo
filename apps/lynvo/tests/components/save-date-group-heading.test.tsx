import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { SaveDateGroupSection } from "~/components/save-list/save-date-group-heading"

describe("SaveDateGroupSection", () => {
  it("renders its anchored heading", () => {
    render(
      <SaveDateGroupSection label="Older">
        <span>Saved links</span>
      </SaveDateGroupSection>
    )

    const heading = screen.getByRole("heading", { name: "Older" })
    expect(heading).toHaveAttribute("id", "save-section-older")
    expect(heading).toHaveClass("font-heading", "text-2xl", "font-bold")
    expect(screen.getByText("Saved links")).toBeInTheDocument()
  })
})
