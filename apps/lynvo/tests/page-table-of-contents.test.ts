import { describe, expect, it } from "vitest"

import { getScrollAdjustment } from "~/components/page-table-of-contents-utils"

describe("documentation outline scrolling", () => {
  it("scrolls down when the active item falls below the visible outline", () => {
    expect(
      getScrollAdjustment({
        containerBottom: 600,
        containerTop: 100,
        itemBottom: 680,
        itemTop: 650,
      })
    ).toBe(88)
  })

  it("scrolls up when the active item rises above the visible outline", () => {
    expect(
      getScrollAdjustment({
        containerBottom: 600,
        containerTop: 100,
        itemBottom: 90,
        itemTop: 60,
      })
    ).toBe(-48)
  })

  it("does not scroll when the active item remains visible", () => {
    expect(
      getScrollAdjustment({
        containerBottom: 600,
        containerTop: 100,
        itemBottom: 350,
        itemTop: 320,
      })
    ).toBe(0)
  })
})
