import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { MediaListRow } from "~/components/save-list/media-list-row"

beforeEach(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
})

describe("MediaListRow", () => {
  it("renders icon, title, meta, and trailing slots beside the activation button", () => {
    render(
      <MediaListRow
        label="Title text"
        icon={<span data-testid="row-icon" />}
        title={{ value: "Title text" }}
        meta={<span>Meta text</span>}
        trailing={<span data-testid="row-trailing" />}
        onActivate={() => {}}
      />
    )

    expect(
      screen.getByRole("button", { name: "Title text" })
    ).toBeInTheDocument()
    expect(screen.getByText("Title text")).toBeVisible()
    expect(screen.getByText("Meta text")).toBeVisible()
    expect(screen.getByTestId("row-icon")).toBeInTheDocument()
    expect(screen.getByTestId("row-trailing")).toBeInTheDocument()
  })

  it("exposes an accessible label when provided", () => {
    render(
      <MediaListRow
        label="Open example"
        icon={null}
        title={{ value: "Title text" }}
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
        label="Title text"
        icon={null}
        title={{ value: "Title text" }}
        onActivate={onActivate}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Title text" }))
    expect(onActivate).toHaveBeenCalledOnce()
  })

  it("blocks activation and mutes the row when disabled", () => {
    const onActivate = vi.fn()
    render(
      <MediaListRow
        label="Title text"
        icon={null}
        title={{ value: "Title text" }}
        onActivate={onActivate}
        disabled
      />
    )

    const rowButton = screen.getByRole("button", { name: "Title text" })
    expect(rowButton).toBeDisabled()
    expect(rowButton).toHaveClass("cursor-not-allowed")
    expect(rowButton.nextElementSibling).toHaveClass("opacity-60")
    fireEvent.click(rowButton)
    expect(onActivate).not.toHaveBeenCalled()
  })

  it("highlights opened rows", () => {
    render(
      <MediaListRow
        label="Title text"
        icon={null}
        title={{ value: "Title text" }}
        onActivate={() => {}}
        isOpened
      />
    )

    expect(screen.getByRole("button", { name: "Title text" })).toHaveClass(
      "bg-sky-500/15"
    )
  })

  it("renders the overlay in a full-height trailing cell beside the button", () => {
    render(
      <MediaListRow
        label="Title text"
        icon={null}
        title={{ value: "Title text" }}
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
    expect(rowButton.nextElementSibling).toHaveClass("flex-1")
    expect(rowButton.parentElement.lastElementChild).toBe(
      overlayAction.parentElement
    )
  })

  it("stacks the icon full width with the overlay beside the title on mobile", () => {
    render(
      <MediaListRow
        label="Title text"
        icon={<span data-testid="row-icon" />}
        title={{ value: "Title text" }}
        meta={<span>Meta text</span>}
        onActivate={() => {}}
        overlay={<button type="button">Overlay action</button>}
        shouldStackIconOnMobile
      />
    )

    const activationButton = screen
      .getAllByRole("button")
      .find((button) => button.className.includes("absolute inset-0"))
    expect(activationButton).toBeDefined()
    const row = activationButton?.parentElement
    expect(row).toHaveClass("flex-col", "md:flex-row")

    const content = screen.getByTestId("row-icon").parentElement
    expect(content).toHaveClass("pointer-events-none")

    const overlayActions = screen.getAllByRole("button", {
      name: "Overlay action",
    })
    const mobileOverlay = overlayActions.find((button) =>
      button.parentElement?.className.includes("md:hidden")
    )
    expect(mobileOverlay?.parentElement).toHaveClass(
      "pointer-events-auto",
      "shrink-0"
    )
    const desktopOverlay = overlayActions.find(
      (button) => button !== mobileOverlay
    )
    expect(desktopOverlay?.parentElement).toHaveClass("hidden", "md:flex")
  })
})
