import { fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter, useLocation } from "react-router"
import { describe, expect, it } from "vitest"
import Changelog from "~/features/site/routes/_site.changelog"

const CurrentLocation = () => {
  const location = useLocation()
  return <output aria-label="Current location">{location.search}</output>
}

describe("Changelog", () => {
  it("reads the selected category from the URL", () => {
    render(
      <MemoryRouter initialEntries={["/changelog?type=plugin-server"]}>
        <Changelog />
      </MemoryRouter>
    )

    const updates = screen.getByRole("region", { name: "Changelog updates" })

    expect(within(updates).getByText("Lynvo Plugin Server")).toBeVisible()
    expect(
      within(updates).queryByText("Product launch")
    ).not.toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Plugin Server" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
  })

  it("updates the URL and visible entries when a tab is selected", () => {
    render(
      <MemoryRouter initialEntries={["/changelog"]}>
        <Changelog />
        <CurrentLocation />
      </MemoryRouter>
    )

    const updates = screen.getByRole("region", { name: "Changelog updates" })

    expect(
      screen.queryByRole("tab", { name: "Platform" })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("tab", { name: "Product" }))
    expect(screen.getByLabelText("Current location")).toHaveTextContent(
      "?type=general"
    )
    expect(within(updates).getByText("Product launch")).toBeVisible()
    expect(
      within(updates).queryByText("Lynvo Plugin Server")
    ).not.toBeInTheDocument()
    expect(
      within(updates).getByText("More reliable link management")
    ).toBeVisible()

    fireEvent.click(screen.getByRole("tab", { name: "Plugin Server" }))
    expect(screen.getByLabelText("Current location")).toHaveTextContent(
      "?type=plugin-server"
    )
    expect(within(updates).getByText("Lynvo Plugin Server")).toBeVisible()
    expect(
      within(updates).queryByText("Product launch")
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("tab", { name: "All" }))
    expect(screen.getByLabelText("Current location")).toBeEmptyDOMElement()
    expect(within(updates).getByText("Product launch")).toBeVisible()
    expect(within(updates).getByText("Lynvo Plugin Server")).toBeVisible()
    expect(
      within(updates).getByText("More reliable link management")
    ).toBeVisible()
  })

  it("keeps same-day updates in release order", () => {
    render(
      <MemoryRouter initialEntries={["/changelog"]}>
        <Changelog />
      </MemoryRouter>
    )

    const updates = screen.getByRole("region", { name: "Changelog updates" })

    expect(
      within(updates).getAllByRole("heading", { level: 2 })[0]
    ).toHaveTextContent("More reliable link management")

    fireEvent.click(screen.getByRole("button", { name: "Sort" }))
    fireEvent.click(
      screen.getByRole("menuitemradio", { name: "Oldest to newest" })
    )

    const sortedHeadings = within(updates).getAllByRole("heading", { level: 2 })
    expect(sortedHeadings[0]).toHaveTextContent("More reliable link management")
    expect(sortedHeadings.at(-1)).toHaveTextContent("Product launch")
  })
})
