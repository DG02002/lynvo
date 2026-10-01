import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { PageTableOfContents } from "~/components/page-table-of-contents"

describe("PageTableOfContents", () => {
  it("renders the outline navigation for a page with headings", () => {
    render(
      <PageTableOfContents
        headings={[
          { id: "configure", label: "Configure" },
          { id: "connect", label: "Connect", level: 3 },
        ]}
      />
    )

    const navigation = screen.getByRole("navigation", {
      name: "On this page",
    })

    expect(navigation).toHaveTextContent("Configure")
    expect(navigation).toHaveTextContent("Connect")
  })

  it("renders nothing when the page has no headings", () => {
    const { container } = render(<PageTableOfContents headings={[]} />)

    expect(container.firstChild).toBeNull()
  })

  it("renders nothing for a policy page without headings", () => {
    const { container } = render(
      <PageTableOfContents headings={[]} variant="policy" />
    )

    expect(container.firstChild).toBeNull()
  })
})
