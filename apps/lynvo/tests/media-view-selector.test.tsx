import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MediaViewSelector } from "~/features/site/settings/media-view-selector"

describe("MediaViewSelector", () => {
  it("shows the List and Hybrid previews and marks the current view", () => {
    render(<MediaViewSelector value="hybrid" onValueChange={vi.fn()} />)

    expect(screen.getByRole("radio", { name: "Hybrid view" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "List view" })).not.toBeChecked()
    expect(screen.getAllByText("Beta")).toHaveLength(1)
    expect(screen.getByText("Browse every saved link in rows.")).toBeVisible()
    expect(
      screen.getByText("Group movies and shows with artwork.")
    ).toBeVisible()
  })

  it("reports a new view when a preview is selected", () => {
    const onValueChange = vi.fn()

    render(<MediaViewSelector value="list" onValueChange={onValueChange} />)

    fireEvent.click(screen.getByRole("radio", { name: "Hybrid view" }))

    expect(onValueChange).toHaveBeenCalledWith("hybrid")
  })
})
