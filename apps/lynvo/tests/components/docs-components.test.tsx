import { fireEvent, render, screen } from "@testing-library/react"
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
})

describe("DocsScreenshot", () => {
  it("shows the expected file name and alt text until an image is added", () => {
    render(
      <DocsScreenshot
        name="example-screenshot-not-captured"
        alt="Settings > Player with Just (Video) Player selected"
      />
    )

    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Settings > Player with Just (Video) Player selected. Expected image: images/example-screenshot-not-captured.png or images/example-screenshot-not-captured.webp"
    )
    expect(
      screen.getByText(
        "images/example-screenshot-not-captured.png or images/example-screenshot-not-captured.webp"
      )
    ).toBeVisible()
  })

  it("opens the screenshot zoomed in and closes it again", () => {
    render(<DocsScreenshot name="settings-general" alt="Settings > General" />)

    fireEvent.click(
      screen.getByRole("button", { name: "Open image: Settings > General" })
    )

    expect(screen.getAllByAltText("Settings > General")).toHaveLength(2)

    fireEvent.click(screen.getAllByAltText("Settings > General")[1])

    expect(screen.getAllByAltText("Settings > General")).toHaveLength(1)
  })
})
