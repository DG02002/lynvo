import { render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { SiteLayoutContent } from "~/features/site/routes/_site"

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
})
