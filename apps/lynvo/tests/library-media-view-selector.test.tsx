import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { LibraryMediaViewSelector } from "~/features/site/settings/library-media-view-selector"

describe("LibraryMediaViewSelector", () => {
  it("shows both view previews and marks the current view", () => {
    render(<LibraryMediaViewSelector value="library" onValueChange={vi.fn()} />)

    expect(screen.getByRole("radio", { name: "Library view" })).toBeChecked()
    expect(screen.getByRole("radio", { name: "List view" })).not.toBeChecked()
    expect(screen.getByText("Beta")).toBeVisible()
    expect(screen.getByText("Browse every saved link in rows.")).toBeVisible()
    expect(
      screen.getByText("Group movies and shows with artwork.")
    ).toBeVisible()
  })

  it("reports a new view when a preview is selected", () => {
    const onValueChange = vi.fn()

    render(
      <LibraryMediaViewSelector value="list" onValueChange={onValueChange} />
    )

    fireEvent.click(screen.getByRole("radio", { name: "Library view" }))

    expect(onValueChange).toHaveBeenCalledWith("library")
  })
})
