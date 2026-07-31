import { render } from "@testing-library/react"
import type { ReactNode } from "react"
import { MemoryRouter } from "react-router"

import { CookiePolicyContent } from "~/features/site/content/cookie-policy-content"
import { PrivacyPolicyContent } from "~/features/site/content/privacy-policy-content"
import { TermsOfUseContent } from "~/features/site/content/terms-of-use-content"
import { UsagePolicyContent } from "~/features/site/content/usage-policy-content"

const renderText = (content: ReactNode) =>
  render(<MemoryRouter>{content}</MemoryRouter>).container.textContent ?? ""

describe("policy copy", () => {
  it("keeps product limits consistent across terms and usage policy", () => {
    const terms = renderText(<TermsOfUseContent />)
    const usage = renderText(<UsagePolicyContent />)

    for (const policy of [terms, usage]) {
      expect(policy).toContain("3 MB")
      expect(policy).toContain("1 MB")
      expect(policy).toContain("100 Recent Links")
      expect(policy).toContain("15 requests per day")
      expect(policy).toContain("200 requests per month")
      expect(policy).toContain("Lynvo Plugin Server")
      expect(policy).toContain("Direct media")
    }
  })

  it("preserves retention and account-inactivity periods", () => {
    const privacy = renderText(<PrivacyPolicyContent />)

    expect(privacy).toContain("90-day retention window")
    expect(privacy).toContain("7, 30, 90, or 180 days")
    expect(privacy).toContain("90 days (3 months)")
  })

  it("matches the cookie consent action labels", () => {
    const cookiePolicy = renderText(<CookiePolicyContent />)

    expect(cookiePolicy).toContain("Accept all cookies")
    expect(cookiePolicy).toContain("Reject optional cookies")
    expect(cookiePolicy).toContain("Manage cookies")
  })
})
