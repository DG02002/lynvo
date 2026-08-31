import { describe, expect, it } from "vitest"
import { selectBestSearchResult } from "../../workers/media-metadata/search-result-selection"

const result = (title: string, providerId: number, year?: number) => ({
  providerId,
  title,
  year,
})

describe("search result selection", () => {
  it("prefers the result whose title matches the query", () => {
    const selected = selectBestSearchResult("Sample Show", [
      result("Quelque chose d'autre", 1),
      result("Sample Show", 64190, 2015),
    ])
    expect(selected?.providerId).toBe(64190)
  })

  it("matches mistyped queries within edit-distance tolerance", () => {
    const selected = selectBestSearchResult("Sample Shows 2015", [
      result("Quelque chose d'autre", 1),
      result("Sample Show", 64190, 2015),
    ])
    expect(selected?.providerId).toBe(64190)
  })

  it("returns nothing when no result genuinely matches", () => {
    const selected = selectBestSearchResult("Sample Show", [
      result("Quelque chose d'autre", 1),
      result("Some Other Show", 2),
    ])
    expect(selected).toBeUndefined()
  })

  it("keeps year-titled works intact", () => {
    const selected = selectBestSearchResult("2050", [
      result("2050", 12345, 2001),
    ])
    expect(selected?.providerId).toBe(12345)
  })
})
