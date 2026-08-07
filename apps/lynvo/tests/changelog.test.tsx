import { fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter, useLocation } from "react-router"
import { describe, expect, it, vi } from "vitest"
import Changelog, {
  ChangelogList,
  type ChangelogEntry,
} from "~/features/site/routes/_site.changelog"

function CurrentLocation() {
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

    fireEvent.click(screen.getByRole("tab", { name: "Product" }))
    expect(screen.getByLabelText("Current location")).toHaveTextContent(
      "?type=general"
    )
    expect(within(updates).getByText("Product launch")).toBeVisible()
    expect(
      within(updates).queryByText("Lynvo Plugin Server")
    ).not.toBeInTheDocument()
    expect(
      within(updates).queryByText("Platform foundation")
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("tab", { name: "Plugin Server" }))
    expect(screen.getByLabelText("Current location")).toHaveTextContent(
      "?type=plugin-server"
    )
    expect(within(updates).getByText("Lynvo Plugin Server")).toBeVisible()
    expect(
      within(updates).queryByText("Product launch")
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("tab", { name: "Platform" }))
    expect(screen.getByLabelText("Current location")).toHaveTextContent(
      "?type=platform"
    )
    expect(within(updates).getByText("Platform foundation")).toBeVisible()
    expect(
      within(updates).queryByText("Lynvo Plugin Server")
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("tab", { name: "All updates" }))
    expect(screen.getByLabelText("Current location")).toBeEmptyDOMElement()
    expect(within(updates).getByText("Product launch")).toBeVisible()
    expect(within(updates).getByText("Lynvo Plugin Server")).toBeVisible()
    expect(within(updates).getByText("Platform foundation")).toBeVisible()
  })

  it("sorts visible updates by release date", () => {
    render(
      <MemoryRouter initialEntries={["/changelog"]}>
        <Changelog />
      </MemoryRouter>
    )

    const updates = screen.getByRole("region", { name: "Changelog updates" })

    expect(
      within(updates).getAllByRole("heading", { level: 3 })[0]
    ).toHaveTextContent("Platform foundation")

    fireEvent.click(screen.getByRole("button", { name: "Sort" }))
    fireEvent.click(
      screen.getByRole("menuitemradio", { name: "Oldest to newest" })
    )

    const sortedHeadings = within(updates).getAllByRole("heading", { level: 3 })
    expect(sortedHeadings[0]).toHaveTextContent("Lynvo Plugin Server")
    expect(sortedHeadings.at(-1)).toHaveTextContent("Platform foundation")
  })

  it("expands long release descriptions", () => {
    const scrollHeight = vi
      .spyOn(HTMLElement.prototype, "scrollHeight", "get")
      .mockReturnValue(96)
    const clientHeight = vi
      .spyOn(HTMLElement.prototype, "clientHeight", "get")
      .mockReturnValue(72)

    render(
      <MemoryRouter initialEntries={["/changelog?type=platform"]}>
        <Changelog />
      </MemoryRouter>
    )

    const platformEntry = screen
      .getByRole("heading", { name: "Platform foundation" })
      .closest("article")

    expect(platformEntry).not.toBeNull()
    const description = within(platformEntry!).getByText(
      /accounts with larger libraries\.$/
    )
    expect(description).toHaveClass("line-clamp-3")

    fireEvent.click(
      within(platformEntry!).getByRole("button", { name: "Show more" })
    )

    expect(description).not.toHaveClass("line-clamp-3")
    expect(
      within(platformEntry!).getByRole("button", { name: "Show less" })
    ).toHaveAttribute("aria-expanded", "true")

    scrollHeight.mockRestore()
    clientHeight.mockRestore()
  })

  it("shows five releases before loading the next batch", () => {
    const scrollHeight = vi
      .spyOn(HTMLElement.prototype, "scrollHeight", "get")
      .mockReturnValue(0)
    const clientHeight = vi
      .spyOn(HTMLElement.prototype, "clientHeight", "get")
      .mockReturnValue(0)

    const entries: ChangelogEntry[] = Array.from({ length: 6 }, (_, index) => ({
      type: "general",
      date: `Jul ${index + 1}, 2026`,
      dateTime: `2026-07-0${index + 1}`,
      title: `Release ${index + 1}`,
      category: "Product",
      description: `Release ${index + 1} description.`,
    }))

    render(<ChangelogList entries={entries} />)

    expect(screen.getByText("Release 5")).toBeVisible()
    expect(screen.queryByText("Release 6")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Show more" })
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Load more" }))

    expect(screen.getByText("Release 6")).toBeVisible()
    expect(
      screen.queryByRole("button", { name: "Load more" })
    ).not.toBeInTheDocument()

    scrollHeight.mockRestore()
    clientHeight.mockRestore()
  })
})
