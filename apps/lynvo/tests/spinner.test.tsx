import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { Spinner } from "~/components/spinner"

describe("Spinner", () => {
  it("uses the Hugeicons stroke-rounded loader", () => {
    const { container } = render(<Spinner />)
    const svg = container.querySelector("svg")
    const path = svg?.querySelector("path")

    expect(svg).toHaveAttribute("viewBox", "0 0 24 24")
    expect(svg).toHaveAttribute("width", "24")
    expect(svg).toHaveAttribute("height", "24")
    expect(svg).toHaveClass("animate-spin")
    expect(svg).toHaveAttribute("data-slot", "spinner")
    expect(svg).toHaveAttribute("role", "status")
    expect(svg).toHaveAttribute("aria-label", "Loading")
    expect(path).toHaveAttribute(
      "d",
      "M21.9961 12C21.9961 17.5228 17.5189 22 11.9961 22C6.47325 22 1.99609 17.5228 1.99609 12C1.99609 6.47715 6.47325 2 11.9961 2"
    )
    expect(path).toHaveAttribute("stroke-width", "1.5")
    expect(path).toHaveAttribute("stroke-linecap", "round")
  })
})
