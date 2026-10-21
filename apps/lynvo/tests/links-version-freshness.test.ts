import { describe, expect, it } from "vitest"

import { shouldFetchLinksVersion } from "~/features/links/use-links/links-store"

describe("saved-link version freshness", () => {
  it("fetches only newer versions unless the request is forced", () => {
    expect(shouldFetchLinksVersion(6, 5)).toBe(false)
    expect(shouldFetchLinksVersion(6, 6)).toBe(false)
    expect(shouldFetchLinksVersion(6, 7)).toBe(true)
    expect(shouldFetchLinksVersion(6, 5, true)).toBe(true)
  })
})
