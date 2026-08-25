import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MediaListRow } from "~/components/save-list/media-list-row"

describe("MediaListRow", () => {
  it("renders icon, title, meta, and trailing slots inside the row button", () => {
    render(
      <MediaListRow
        icon={<span data-testid="row-icon" />}
        title={<span>Title text</span>}
        meta={<span>Meta text</span>}
        trailing={<span data-testid="row-trailing" />}
        onActivate={() => {}}
      />
    )

    const rowButton = screen.getByRole("button")
    expect(rowButton).toHaveTextContent("Title text")
    expect(rowButton).toHaveTextContent("Meta text")
    expect(screen.getByTestId("row-icon")).toBeInTheDocument()
    expect(screen.getByTestId("row-trailing")).toBeInTheDocument()
  })

  it("exposes an accessible label when provided", () => {
    render(
      <MediaListRow
        label="Open example"
        icon={null}
        title={<span>Title text</span>}
        onActivate={() => {}}
      />
    )

    expect(
      screen.getByRole("button", { name: "Open example" })
    ).toBeInTheDocument()
  })

  it("fires onActivate when the row is clicked", () => {
    const onActivate = vi.fn()
    render(
      <MediaListRow
        icon={null}
        title={<span>Title text</span>}
        onActivate={onActivate}
      />
    )

    fireEvent.click(screen.getByRole("button"))
    expect(onActivate).toHaveBeenCalledOnce()
  })

  it("blocks activation and mutes the row when disabled", () => {
    const onActivate = vi.fn()
    render(
      <MediaListRow
        icon={null}
        title={<span>Title text</span>}
        onActivate={onActivate}
        disabled
      />
    )

    const rowButton = screen.getByRole("button")
    expect(rowButton).toBeDisabled()
    expect(rowButton).toHaveClass("opacity-60", "cursor-not-allowed")
    fireEvent.click(rowButton)
    expect(onActivate).not.toHaveBeenCalled()
  })

  it("highlights opened rows", () => {
    render(
      <MediaListRow
        icon={null}
        title={<span>Title text</span>}
        onActivate={() => {}}
        isOpened
      />
    )

    expect(screen.getByRole("button")).toHaveClass("bg-sky-500/15")
  })

  it("renders the overlay in a full-height trailing cell beside the button", () => {
    render(
      <MediaListRow
        icon={null}
        title={<span>Title text</span>}
        onActivate={() => {}}
        overlay={<button type="button">Overlay action</button>}
      />
    )

    const overlayAction = screen.getByRole("button", {
      name: "Overlay action",
    })
    expect(overlayAction).toBeInTheDocument()
    expect(overlayAction.parentElement).toHaveClass("w-16", "text-foreground")
    expect(overlayAction.parentElement).not.toHaveClass("border-s")
    const rowButton = screen.getByRole("button", { name: "Title text" })
    expect(rowButton).toHaveClass("flex-1")
    expect(rowButton.parentElement.lastElementChild).toBe(
      overlayAction.parentElement
    )
  })
})
