import { fireEvent, render, screen, waitFor } from "@testing-library/react"

import { MobilePageOutline } from "../app/components/mobile-page-outline"

describe("MobilePageOutline", () => {
  it("expands supplied headings and collapses after navigation", () => {
    document.body.innerHTML = '<h2 id="first-section">First section</h2>'
    Element.prototype.scrollIntoView = vi.fn()
    window.matchMedia = vi.fn().mockReturnValue({ matches: true })

    render(
      <MobilePageOutline
        headings={[
          { id: "first-section", label: "First section" },
          { id: "second-section", label: "Second section", level: 3 },
        ]}
      />
    )

    const trigger = screen.getByRole("button", { name: "First section" })
    const panel = document.getElementById(
      trigger.getAttribute("aria-controls") ?? ""
    )
    expect(panel).toHaveAttribute("aria-hidden", "true")
    expect(panel).toHaveClass("opacity-0")

    fireEvent.click(trigger)
    expect(trigger).toHaveAttribute("aria-expanded", "true")
    expect(panel).toHaveAttribute("aria-hidden", "false")
    expect(panel).toHaveClass("opacity-100")

    fireEvent.click(screen.getByRole("link", { name: "First section" }))
    expect(trigger).toHaveAttribute("aria-expanded", "false")
    expect(panel).toHaveAttribute("aria-hidden", "true")
    expect(panel).toHaveClass("opacity-0")
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled()
  })

  it("discovers policy headings from the target content", async () => {
    render(
      <>
        <MobilePageOutline targetId="policy-content" />
        <div id="policy-content">
          <h2 id="what-lynvo-does">1. What Lynvo does</h2>
        </div>
      </>
    )

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "1. What Lynvo does" })
      ).toBeInTheDocument()
    )
  })

  it("appears only after the introduction passes behind the header", async () => {
    let introductionBottom = 120
    document.body.innerHTML = `
      <p id="introduction">Introduction</p>
      <h2 id="first-section">First section</h2>
    `
    const introduction = document.getElementById("introduction")
    vi.spyOn(introduction!, "getBoundingClientRect").mockImplementation(() =>
      DOMRect.fromRect({ height: introductionBottom })
    )

    render(
      <MobilePageOutline
        headings={[{ id: "first-section", label: "First section" }]}
        revealAfterSelector="#introduction"
      />
    )

    const trigger = screen.getByRole("button", {
      name: "First section",
      hidden: true,
    })
    await waitFor(() => expect(trigger).toHaveClass("opacity-0"))

    introductionBottom = 63
    fireEvent.scroll(window)

    await waitFor(() => expect(trigger).toHaveClass("opacity-100"))
  })
})
