import { describe, expect, it } from "vitest"
import { selectBestSearchResult } from "../../workers/media-metadata/search-result-selection"

const result = (title: string, providerId: number, year?: number) => ({
  providerId,
  title,
  year,
})

describe("search result selection", () => {
  it("prefers the result whose title matches the query", () => {
    const selected = selectBestSearchResult("Overlord", [
      result("À chaque minute compte", 1),
      result("Overlord", 64196, 2015),
    ])
    expect(selected?.providerId).toBe(64196)
  })

  it("matches mistyped queries within edit-distance tolerance", () => {
    const selected = selectBestSearchResult("Overload 2015", [
      result("À chaque minute compte", 1),
      result("Overlord", 64196, 2015),
    ])
    expect(selected?.providerId).toBe(64196)
  })

  it("returns nothing when no result genuinely matches", () => {
    const selected = selectBestSearchResult("Overlord", [
      result("À chaque minute compte", 1),
      result("Some Other Show", 2),
    ])
    expect(selected).toBeUndefined()
  })

  it("keeps year-titled works intact", () => {
    const selected = selectBestSearchResult("2012", [
      result("2012", 14161, 2009),
    ])
    expect(selected?.providerId).toBe(14161)
  })
})
