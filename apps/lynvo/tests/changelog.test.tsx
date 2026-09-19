import { fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter, useLocation } from "react-router"
import { describe, expect, it } from "vitest"

import Changelog from "~/features/site/routes/_site.changelog"

const CurrentLocation = () => {
  const location = useLocation()
  return <output aria-label="Current location">{location.search}</output>
}

const PLUGIN_SERVER_ENTRY_TITLE = "Plugin Server usage is easier to follow"
const PLUGIN_SERVER_ENTRY_QUERY = {
  level: 2,
  name: PLUGIN_SERVER_ENTRY_TITLE,
} as const

const getPluginServerEntryHeading = (updates: HTMLElement) =>
  within(updates).getByRole("heading", PLUGIN_SERVER_ENTRY_QUERY)

const queryPluginServerEntryHeading = (updates: HTMLElement) =>
  within(updates).queryByRole("heading", PLUGIN_SERVER_ENTRY_QUERY)

describe("Changelog", () => {
  it("reads the selected category from the URL", () => {
    render(
      <MemoryRouter initialEntries={["/changelog?type=plugin-server"]}>
        <Changelog />
      </MemoryRouter>
    )

    const updates = screen.getByRole("region", { name: "Changelog updates" })

    expect(getPluginServerEntryHeading(updates)).toBeVisible()
    expect(
      within(updates).queryByText(
        "The library’s grouped presentation is now called Gallery"
      )
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
    expect(
      within(updates).getByText(
        "The library’s grouped presentation is now called Gallery"
      )
    ).toBeVisible()
    expect(
      within(updates).getByText("The library now has List and Gallery views")
    ).toBeVisible()
    expect(queryPluginServerEntryHeading(updates)).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("tab", { name: "Plugin Server" }))
    expect(screen.getByLabelText("Current location")).toHaveTextContent(
      "?type=plugin-server"
    )
    expect(getPluginServerEntryHeading(updates)).toBeVisible()
    expect(
      within(updates).queryByText(
        "The library’s grouped presentation is now called Gallery"
      )
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("tab", { name: "All" }))
    expect(screen.getByLabelText("Current location")).toBeEmptyDOMElement()
    expect(
      within(updates).getByText(
        "The library’s grouped presentation is now called Gallery"
      )
    ).toBeVisible()
    expect(
      within(updates).getByText("The library now has List and Gallery views")
    ).toBeVisible()
    expect(getPluginServerEntryHeading(updates)).toBeVisible()
  })

  it("shows the current release before older history", () => {
    render(
      <MemoryRouter initialEntries={["/changelog"]}>
        <Changelog />
      </MemoryRouter>
    )

    const updates = screen.getByRole("region", { name: "Changelog updates" })

    expect(
      within(updates).getAllByRole("heading", { level: 2 })[0]
    ).toHaveTextContent(
      "The library’s grouped presentation is now called Gallery"
    )

    fireEvent.click(screen.getByRole("button", { name: "Sort" }))
    fireEvent.click(
      screen.getByRole("menuitemradio", { name: "Oldest to newest" })
    )

    const sortedHeadings = within(updates).getAllByRole("heading", { level: 2 })
    expect(sortedHeadings[0]).toHaveTextContent("More reliable link management")
    expect(sortedHeadings[1]).toHaveTextContent(PLUGIN_SERVER_ENTRY_TITLE)
    expect(sortedHeadings[2]).toHaveTextContent("Product launch")
  })
})
