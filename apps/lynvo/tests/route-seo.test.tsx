import { render, waitFor } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { RouteSeoMetadata } from "../app/root/route-seo-metadata"

const renderPath = (path: string) => {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <RouteSeoMetadata />
    </MemoryRouter>
  )
}

describe("route SEO metadata", () => {
  it("renders the production canonical and social metadata for public routes", async () => {
    renderPath("/about")
    await waitFor(() => {
      expect(
        document.head.querySelector('link[rel="canonical"]')
      ).toHaveAttribute("href", "https://lynvo.dg02002.workers.dev/about")
    })
    expect(
      document.head.querySelector('meta[property="og:url"]')
    ).toHaveAttribute("content", "https://lynvo.dg02002.workers.dev/about")
    expect(
      document.head.querySelector('meta[name="twitter:card"]')
    ).toHaveAttribute("content", "summary_large_image")
    expect(document.head.querySelector('link[rel="sitemap"]')).toHaveAttribute(
      "href",
      "https://lynvo.dg02002.workers.dev/sitemap.xml"
    )
  })

  it("marks private routes noindex without a canonical URL", async () => {
    renderPath("/settings/security")
    await waitFor(() => {
      expect(
        document.head.querySelector('meta[name="robots"]')
      ).toHaveAttribute("content", "noindex, nofollow")
    })
    expect(document.head.querySelector('link[rel="canonical"]')).toBeNull()
  })
})
