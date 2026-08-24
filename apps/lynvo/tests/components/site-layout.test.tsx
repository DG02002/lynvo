import { render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import { SiteLayoutContent } from "~/features/site/routes/_site"
import { setShouldShowLayoutGuide } from "~/features/site/settings/layout-guide-preference"
import { createMemoryStorage } from "../memory-storage"

const Header = ({ showSaveAction }: { showSaveAction: boolean }) => (
  <header data-testid="site-header" data-show-save-action={showSaveAction} />
)
const Footer = () => <footer data-testid="site-footer" />
const EmptyComponent = () => null

const renderLayout = (pathname: string, content: ReactNode) =>
  render(
    <SiteLayoutContent
      pathname={pathname}
      HeaderComponent={Header}
      FooterComponent={Footer}
      RemoteCommandListenerComponent={EmptyComponent}
      ReceiverOverlayComponent={EmptyComponent}
    >
      {content}
    </SiteLayoutContent>
  )

describe("SiteLayout", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMemoryStorage())
    setShouldShowLayoutGuide(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    setShouldShowLayoutGuide(false)
    vi.unstubAllGlobals()
  })

  it("hides the header Save action on the Save page", () => {
    renderLayout("/save", <div>Save page</div>)

    expect(screen.getByTestId("site-header")).toHaveAttribute(
      "data-show-save-action",
      "false"
    )
  })

  it("renders only route content while a saved folder hydrates", () => {
    renderLayout(
      "/save/folder/saved-link-id",
      <div role="status">Loading saved links…</div>
    )

    expect(screen.getByText("Loading saved links…")).toBeVisible()
    expect(screen.queryByTestId("site-header")).not.toBeInTheDocument()
    expect(screen.queryByTestId("site-footer")).not.toBeInTheDocument()
    expect(screen.getByRole("main")).toHaveClass("pt-0")
  })

  it("shows the layout guide across save and full-screen surfaces", () => {
    setShouldShowLayoutGuide(true)
    const { unmount } = renderLayout("/save", <div>Save page</div>)

    expect(document.querySelector("[data-layout-guide]")).toHaveAttribute(
      "data-layout-guide-surface",
      "save"
    )

    unmount()
    renderLayout("/save/title/group-id", <div>Title page</div>)

    expect(document.querySelector("[data-layout-guide]")).toHaveAttribute(
      "data-layout-guide-surface",
      "fullscreen"
    )
  })

  it("keeps the layout guide visible on the saved folder surface", async () => {
    setShouldShowLayoutGuide(true)
    const guideRects = new Map([
      ["list-header", new DOMRect(0, 0, 1024, 64)],
      ["list-sidebar", new DOMRect(0, 64, 256, 704)],
      ["list-content", new DOMRect(256, 64, 768, 704)],
    ])
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function () {
        return (
          guideRects.get(this.dataset.layoutGuideTarget ?? "") ?? new DOMRect()
        )
      }
    )

    renderLayout(
      "/save/folder/saved-link-id",
      <>
        <header data-layout-guide-target="list-header" />
        <aside data-layout-guide-target="list-sidebar" />
        <div data-layout-guide-target="list-content" />
      </>
    )

    await waitFor(() =>
      expect(
        document.querySelectorAll('[data-layout-guide-line="vertical"]')
      ).not.toHaveLength(0)
    )
    expect(
      document.querySelectorAll('[data-layout-guide-line="horizontal"]')
    ).not.toHaveLength(0)
  })
})
