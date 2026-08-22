import { renderToString } from "react-dom/server"

import { PolicyLayout, PolicySection } from "../app/components/policy-layout"

describe("PolicyLayout", () => {
  it("reserves the mobile outline layout during server rendering", () => {
    const markup = renderToString(
      <PolicyLayout title="Terms of use" updatedAt="August 8, 2026">
        <p>Introduction</p>
        <PolicySection title="Account terms">
          <p>Policy text</p>
        </PolicySection>
      </PolicyLayout>
    )

    expect(markup).toContain('aria-expanded="false"')
  })
})
