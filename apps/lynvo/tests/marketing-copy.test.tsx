import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { describe, expect, it } from "vitest"
import { PlanSection } from "~/features/site/home/home-sections"
import Pricing from "~/features/site/routes/_site.pricing"
import { pricingFaqs } from "~/features/site/pricing/pricing-content"

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
      screen.getByText("200, shared across Lynvo Plugins and direct media")
    ).toBeVisible()
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
})
