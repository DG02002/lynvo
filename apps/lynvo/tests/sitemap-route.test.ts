import { loader } from "../app/features/site/routes/sitemap"

describe("sitemap route", () => {
  it("returns only canonical public production URLs", async () => {
    const response = await loader()
    const xml = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toBe(
      "application/xml; charset=utf-8"
    )
    expect(xml).toContain("<loc>https://lynvo.dg02002.workers.dev/about</loc>")
    expect(xml).toContain("<loc>https://lynvo.dg02002.workers.dev/docs</loc>")
    expect(xml).not.toContain("/settings")
    expect(xml).not.toContain("/auth/")
  })
})
