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

  it("matches apostrophe titles against filename-style queries", () => {
    const tmdbTitle = "KonoSuba: God's Blessing on This Wonderful World!"
    expect(
      selectBestSearchResult("KonoSuba Gods Blessing", [
        result(tmdbTitle, 12345, 2024),
      ])
    ).toMatchObject({ providerId: 12345 })
    expect(
      selectBestSearchResult("KonoSuba: God's Blessing", [
        result(tmdbTitle, 12345, 2024),
      ])
    ).toMatchObject({ providerId: 12345 })
  })

  it("matches non-latin titles and folds latin accents", () => {
    expect(
      selectBestSearchResult("몽정기 2", [result("몽정기 2", 99, 2005)])
    ).toMatchObject({ providerId: 99 })
    expect(
      selectBestSearchResult("Tokyo Story", [result("Tôkyô Story", 100, 1953)])
    ).toMatchObject({ providerId: 100 })
  })

  it("treats ampersand and the word and as the same title spelling", () => {
    expect(
      selectBestSearchResult("Law and Order", [result("Law & Order", 549)], {
        requireExactTitleMatch: true,
      })
    ).toMatchObject({ providerId: 549 })
    expect(
      selectBestSearchResult("Law & Order", [result("Law and Order", 550)], {
        requireExactTitleMatch: true,
      })
    ).toMatchObject({ providerId: 550 })
  })

  it("rejects near matches when a folder requires the exact TV title", () => {
    expect(
      selectBestSearchResult(
        "Breaking Ba",
        [result("Breaking Bad", 1396, 2008)],
        { requireExactTitleMatch: true }
      )
    ).toBeUndefined()
    expect(
      selectBestSearchResult("Breaking Ba", [result("Breaking Bad", 1396)])
    ).toMatchObject({ providerId: 1396 })
  })

  it("refuses an exact-title tie across different years", () => {
    const selected = selectBestSearchResult("The Avengers", [
      result("The Avengers", 101, 1998),
      result("The Avengers", 24428, 2012),
    ])
    expect(selected).toBeUndefined()
  })

  it("prefers a dated exact-title match over an undated duplicate", () => {
    const selected = selectBestSearchResult("The Avengers", [
      result("The Avengers", 1),
      result("The Avengers", 24428, 2012),
    ])
    expect(selected?.providerId).toBe(24428)
  })

  it("picks through same-year title ties", () => {
    const selected = selectBestSearchResult("The Avengers", [
      result("The Avengers", 101, 2012),
      result("The Avengers", 24428, 2012),
    ])
    expect(selected?.providerId).toBe(101)
  })
})
