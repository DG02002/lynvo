import { describe, expect, it } from "vitest"

import {
  buildOutlineRail,
  getScrollAdjustment,
  type OutlineRailRow,
} from "~/components/page-table-of-contents-utils"

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

describe("documentation outline rail", () => {
  const row = (top: number, bottom: number): OutlineRailRow => ({
    bottom,
    top,
  })

  it("returns undefined without rows", () => {
    expect(buildOutlineRail([], 0)).toBeUndefined()
  })

  it("draws one straight rail from the first row to the last", () => {
    const rail = buildOutlineRail([row(0, 40), row(60, 100), row(120, 160)], 0)

    expect(rail?.basePath).toBe("M 1 0 L 1 160")
  })

  it("keeps the rail straight when the list ends on a nested row", () => {
    const rail = buildOutlineRail([row(10, 50)], 0)

    expect(rail?.basePath).toBe("M 1 10 L 1 50")
  })

  it("highlights the active row's slice of the line", () => {
    const rail = buildOutlineRail([row(0, 40), row(60, 100), row(120, 160)], 1)

    expect(rail?.activeDash).toEqual({ length: 40, offset: -60, total: 160 })
  })

  it("falls back to the first row for an unknown active index", () => {
    const rail = buildOutlineRail([row(0, 40), row(60, 100)], -1)

    expect(rail?.activeDash).toEqual({ length: 40, offset: 0, total: 100 })
  })
})
