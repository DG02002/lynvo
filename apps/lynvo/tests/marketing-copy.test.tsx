import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { describe, expect, it } from "vitest"
import { PlanSection } from "~/features/site/home/home-sections"
import { meta as homeMeta } from "~/features/site/routes/_site._index"
import Pricing from "~/features/site/routes/_site.pricing"
import { pricingFaqs } from "~/features/site/pricing/pricing-content"

const siteManifest = JSON.parse(
  readFileSync(resolve(process.cwd(), "public/site.webmanifest"), "utf8")
) as {
  name: string
  description: string
  orientation?: string
}

describe("marketing and pricing copy", () => {
  it("states the implemented Free plan limits without unsupported claims", () => {
    render(<PlanSection />)

    expect(screen.getByText("3 MB of storage")).toBeVisible()
    expect(
      screen.getByText("Save up to 100 links, subject to the storage limit.")
    ).toBeVisible()
    expect(screen.queryByText(/limited time/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/flawlessly|instantly/i)).not.toBeInTheDocument()
  })

  it("explains the shared Lynvo Plugin Server allowance", () => {
    render(
      <MemoryRouter>
        <Pricing />
      </MemoryRouter>
    )

    expect(
      screen.getByText("200, shared across Lynvo Plugins and Direct Media")
    ).toBeVisible()
    expect(screen.getByText("Coming soon.")).toBeVisible()
    expect(screen.queryByText("Not available yet.")).not.toBeInTheDocument()
    expect(
      screen.queryByText(
        "Plans with higher limits may be added as Lynvo grows."
      )
    ).not.toBeInTheDocument()
    expect(screen.getByText("Plugins and Remote Play")).toBeVisible()
    expect(
      screen.queryByText("Plugins and Android devices")
    ).not.toBeInTheDocument()
    expect(
      screen.getAllByRole("link", { name: "Create a free account" })
    ).toHaveLength(2)
    expect(screen.queryByText(/reasonable usage/i)).not.toBeInTheDocument()
  })

  it("keeps pricing FAQ quantities consistent with the plan", () => {
    const faqCopy = pricingFaqs
      .map((faq) => `${faq.question} ${faq.answer}`)
      .join(" ")

    expect(faqCopy).toContain("3 MB")
    expect(faqCopy).toContain("100 saved links")
    expect(faqCopy).toContain("200-request monthly allowance")
    expect(faqCopy).toContain("15-request daily limit")
  })

  it("keeps app metadata aligned with Lynvo's Android platforms", () => {
    expect(homeMeta({} as never)).toContainEqual({
      title: "Lynvo | Save links. Open them in Android players.",
    })
    expect(siteManifest.name).toBe(
      "Lynvo - Save links. Open them in Android players."
    )
    expect(siteManifest.description).toContain("Android phones")
    expect(siteManifest.description).toContain("Android tablets")
    expect(siteManifest.description).toContain("Android TV")
    expect(siteManifest.description).toContain("Just (Video) Player")
    expect(siteManifest.description).toContain("VLC for Android")
    expect(siteManifest.description).toContain("MPV")
    expect(siteManifest.description).toContain("MX Player")
    expect(siteManifest.orientation).toBeUndefined()
  })
})
