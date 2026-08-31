import { renderToString } from "react-dom/server"
import { MemoryRouter } from "react-router"
import { describe, expect, it } from "vitest"
import { LicensesContent } from "../app/features/site/content/licenses-content"

describe("LicensesContent", () => {
  it("includes the official TMDB logo and attribution notice", () => {
    const markup = renderToString(
      <MemoryRouter>
        <LicensesContent />
      </MemoryRouter>
    )

    expect(markup).toContain("https://www.themoviedb.org")
    expect(markup).toContain(
      "blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg"
    )
    expect(markup).toContain(
      "This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB."
    )
    const logoMarkup = markup.match(/<img[^>]+alt="TMDB"[^>]*>/)?.[0]
    expect(logoMarkup).toContain('class="block h-32 w-auto"')
    expect(logoMarkup).toContain("data-not-typeset")
    expect(logoMarkup).not.toMatch(/rounded|border|bg-|shadow|ring/)
  })
})
