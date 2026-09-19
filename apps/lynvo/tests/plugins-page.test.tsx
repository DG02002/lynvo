import { fireEvent, render, screen } from "@testing-library/react"
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

it("offers a retry when the Plugin catalog is unavailable", async () => {
  let loadCount = 0
  const RoutesStub = createRoutesStub([
    {
      path: "/",
      Component: Plugins,
      loader: () => {
        loadCount += 1
        return {
          lynvoPlugins:
            loadCount === 1
              ? null
              : [
                  {
                    id: "recovered-plugin",
                    name: "Recovered Plugin",
                    description: "Supports recovered links.",
                    sourceUrl: "https://example.com/recovered",
                  },
                ],
        }
      },
    },
  ])

  render(<RoutesStub />)

  expect(
    await screen.findByText(
      "Lynvo plugin information is currently unavailable."
    )
  ).toBeVisible()
  fireEvent.click(await screen.findByRole("button", { name: "Try again" }))

  expect(await screen.findByText("Recovered Plugin")).toBeVisible()
})
