import { render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"

vi.mock("react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-router")>()),
  useLoaderData: () => ({
    lynvoPlugins: [
      {
        id: "example-plugin",
        name: "Example Plugin",
        description: "Supports example links.",
        sourceUrl: "https://example.com",
      },
    ],
  }),
}))

import Plugins from "~/features/site/routes/_site.plugins"

it("stacks Plugin descriptions within the standard mobile page gutter", () => {
  const { container } = render(<Plugins />)

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
