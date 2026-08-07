import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { HomeSaveDemo } from "~/features/site/home/home-save-demo"

describe("HomeSaveDemo", () => {
  it("keeps animated content in flow so the page height stays stable", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )

    const { container } = render(<HomeSaveDemo />)
    expect(
      screen.getByLabelText("Animated preview of saving a video link to Lynvo")
    ).toBeInTheDocument()

    for (const element of container.querySelectorAll(
      ".home-demo-clipboard-reveal, .home-demo-created-item"
    )) {
      expect(element.className).not.toContain("grid-template-rows")
      expect(element.className).not.toContain("grid-rows-[0fr]")
    }
  })
})
