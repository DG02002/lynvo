import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import { vi } from "vitest"

vi.mock("~/components/Header", () => ({
  Header: () => <header data-testid="site-header" />,
}))
vi.mock("~/components/Footer", () => ({
  Footer: () => <footer data-testid="site-footer" />,
}))
vi.mock("~/components/RemoteCommandListener", () => ({
  RemoteCommandListener: () => null,
}))
vi.mock("~/components/ReceiverOverlay", () => ({
  ReceiverOverlay: () => null,
}))

import SiteLayout from "~/features/site/routes/_site"

describe("SiteLayout", () => {
  it("renders only route content while a saved folder hydrates", () => {
    render(
      <MemoryRouter initialEntries={["/save/folder/saved-link-id"]}>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route
              path="/save/folder/:savedLinkId"
              element={<div role="status">Loading saved links…</div>}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    )

    expect(screen.getByText("Loading saved links…")).toBeVisible()
    expect(screen.queryByTestId("site-header")).not.toBeInTheDocument()
    expect(screen.queryByTestId("site-footer")).not.toBeInTheDocument()
    expect(screen.getByRole("main")).toHaveClass("pt-0")
  })
})
