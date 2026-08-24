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
      "blue_long_2-9665a76b1ae401a510ec1e0ca40ddcb3b0cfe45f1d51b77a308fea0845885648.svg"
    )
    expect(markup).toContain(
      "This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB."
    )
  })
})
