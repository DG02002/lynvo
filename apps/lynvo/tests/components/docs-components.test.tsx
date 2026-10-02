import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { DocsFaq, DocsScreenshot } from "~/features/site/docs/docs-components"

describe("DocsFaq", () => {
  it("uses the shared accordion disclosure for the question and answer", () => {
    render(
      <DocsFaq question="Why does my device not appear?">
        Keep Lynvo open on the device, then search again.
      </DocsFaq>
    )

    const question = screen.getByRole("button", {
      name: "Why does my device not appear?",
    })

    expect(question).toHaveAttribute("aria-expanded", "false")
    fireEvent.click(question)
    expect(question).toHaveAttribute("aria-expanded", "true")
    expect(
      screen.getByText("Keep Lynvo open on the device, then search again.")
    ).toBeInTheDocument()
    fireEvent.click(question)
    expect(question).toHaveAttribute("aria-expanded", "false")
  })

  it("anchors each question with a stable slug for deep links", () => {
    render(
      <DocsFaq question="Why does my device not appear?">
        Keep Lynvo open on the device.
      </DocsFaq>
    )

    expect(
      document.getElementById("faq-why-does-my-device-not-appear")
    ).not.toBeNull()
    expect(
      screen.getByRole("link", {
        name: "Link to Why does my device not appear?",
      })
    ).toHaveAttribute("href", "#faq-why-does-my-device-not-appear")
  })

  it("opens the question targeted by the location hash", () => {
    window.location.hash = "#faq-why-does-my-device-not-appear"

    try {
      render(
        <DocsFaq question="Why does my device not appear?">
          Keep Lynvo open on the device.
        </DocsFaq>
      )

      expect(
        screen.getByRole("button", { name: "Why does my device not appear?" })
      ).toHaveAttribute("aria-expanded", "true")
    } finally {
      window.history.replaceState(null, "", window.location.pathname)
    }
  })

  it("opens the question when its anchor link is clicked", () => {
    render(
      <DocsFaq question="Why does my device not appear?">
        Keep Lynvo open on the device.
      </DocsFaq>
    )

    fireEvent.click(
      screen.getByRole("link", {
        name: "Link to Why does my device not appear?",
      })
    )

    expect(
      screen.getByRole("button", { name: "Why does my device not appear?" })
    ).toHaveAttribute("aria-expanded", "true")
  })
})

describe("DocsScreenshot", () => {
  it("throws when a screenshot asset is missing", () => {
    expect(() =>
      render(
        <DocsScreenshot
          name="example-screenshot-not-captured"
          alt="Settings > Player with Just (Video) Player selected"
        />
      )
    ).toThrow(
      "Documentation screenshot asset is missing: example-screenshot-not-captured"
    )
  })

  it("opens the screenshot zoomed in and closes it again", async () => {
    render(<DocsScreenshot name="settings-general" alt="Settings > General" />)

    fireEvent.click(
      screen.getByRole("button", { name: "Open image: Settings > General" })
    )

    expect(screen.getAllByAltText("Settings > General")).toHaveLength(2)

    fireEvent.click(screen.getAllByAltText("Settings > General")[1])

    // The collapse transition runs before the viewer unmounts.
    await waitFor(() =>
      expect(screen.getAllByAltText("Settings > General")).toHaveLength(1)
    )
  })

  it("closes the zoomed screenshot from the keyboard", async () => {
    render(<DocsScreenshot name="settings-general" alt="Settings > General" />)

    fireEvent.click(
      screen.getByRole("button", { name: "Open image: Settings > General" })
    )

    fireEvent.keyDown(window, { key: "Escape" })

    await waitFor(() =>
      expect(screen.getAllByAltText("Settings > General")).toHaveLength(1)
    )
  })
})
