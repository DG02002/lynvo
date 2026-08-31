import { render, screen } from "@testing-library/react"
import { createRoutesStub } from "react-router"
import { expect, it } from "vitest"

import Plugins from "~/features/site/routes/_site.plugins"

it("stacks Plugin descriptions within the standard mobile page gutter", async () => {
  const RoutesStub = createRoutesStub([
    {
      path: "/",
      Component: Plugins,
      loader: () => ({
        lynvoPlugins: [
          {
            id: "example-plugin",
            name: "Example Plugin",
            description: "Supports example links.",
            sourceUrl: "https://example.com",
          },
        ],
      }),
    },
  ])
  const { container } = render(<RoutesStub />)
  await screen.findByRole("table")

  expect(container.firstElementChild).toHaveClass("px-6")
  expect(screen.getByRole("table").querySelector("thead")).toHaveClass(
    "hidden",
    "md:table-header-group"
  )
  expect(screen.getByText("Supports example links.").closest("td")).toHaveClass(
    "block",
    "md:table-cell"
  )
})
