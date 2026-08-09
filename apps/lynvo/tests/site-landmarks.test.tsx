import { render } from "@testing-library/react"
import { createMemoryRouter, RouterProvider } from "react-router"
import { vi } from "vitest"
import SiteLayout from "../app/features/site/routes/_site"
import About from "../app/features/site/routes/_site.about"

vi.mock("~/components/Header", () => ({ Header: () => <header /> }))
vi.mock("~/components/Footer", () => ({ Footer: () => <footer /> }))
vi.mock("~/components/RemoteCommandListener", () => ({
  RemoteCommandListener: () => null,
}))
vi.mock("~/components/ReceiverOverlay", () => ({ ReceiverOverlay: () => null }))

describe("site landmarks", () => {
  it("renders exactly one main landmark for a site route", () => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          element: <SiteLayout />,
          children: [{ index: true, element: <About /> }],
        },
      ],
      { initialEntries: ["/"] }
    )
    const rendered = render(<RouterProvider router={router} />)
    expect(rendered.container.querySelectorAll("main")).toHaveLength(1)
  })

  it("uses policy typography for the About page", () => {
    const rendered = render(<About />)

    expect(rendered.container.querySelector(".typeset-policy")).not.toBeNull()
    expect(rendered.container.querySelector(".typeset-article")).toBeNull()
  })
})
