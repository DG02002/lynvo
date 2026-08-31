import { loader } from "../app/features/site/routes/sitemap"
import { PRODUCTION_ORIGIN } from "../app/root/route-seo-metadata"

describe("sitemap route", () => {
  it("returns only canonical public production URLs", async () => {
    const response = await loader()
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe(
      "application/xml; charset=utf-8"
    )
    expect(xml).toContain(`<loc>${PRODUCTION_ORIGIN}/about</loc>`)
    expect(xml).toContain(`<loc>${PRODUCTION_ORIGIN}/docs</loc>`)
    expect(xml).not.toContain("/settings")
    expect(xml).not.toContain("/auth/")
  })
})
