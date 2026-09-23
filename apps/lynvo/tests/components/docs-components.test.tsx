import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { DocsFaq, DocsScreenshot } from "~/features/site/docs/docs-components"

describe("DocsFaq", () => {
  it("uses a keyboard-operable disclosure for the question and answer", () => {
    render(
      <DocsFaq question="Why does my device not appear?">
        Keep Lynvo open on the device, then search again.
      </DocsFaq>
    )

    const question = screen.getByText("Why does my device not appear?")
    const disclosure = question.closest("details")

    expect(question.tagName).toBe("SUMMARY")
    expect(disclosure).not.toHaveAttribute("open")
    fireEvent.click(question)
    expect(disclosure).toHaveAttribute("open")
    expect(
      screen.getByText("Keep Lynvo open on the device, then search again.")
    ).toBeVisible()
  })
})

describe("DocsScreenshot", () => {
  it("shows the expected file name and alt text until an image is added", () => {
    render(
      <DocsScreenshot
        name="settings-player"
        alt="Settings > Player with Just (Video) Player selected"
      >
        Player defaults
      </DocsScreenshot>
    )

    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Settings > Player with Just (Video) Player selected. Expected image: images/settings-player.png or images/settings-player.webp"
    )
    expect(
      screen.getByText(
        "images/settings-player.png or images/settings-player.webp"
      )
    ).toBeVisible()
    expect(screen.getByText("Player defaults")).toBeVisible()
  })
})
