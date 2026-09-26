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
  const row = (top: number, bottom: number, level: 2 | 3): OutlineRailRow => ({
    bottom,
    level,
    top,
  })

  it("returns undefined without rows", () => {
    expect(buildOutlineRail([], 0, 12)).toBeUndefined()
  })

  it("draws a straight rail when every heading is top level", () => {
    const rail = buildOutlineRail([row(0, 40, 2), row(40, 80, 2)], 0, 12)

    expect(rail?.basePath).toBe("M 0 0 L 0 80")
    expect(rail?.activeSegment).toEqual({ top: 0, bottom: 40 })
  })

  it("softens the base rail steps around nested headings", () => {
    const rail = buildOutlineRail(
      [row(0, 40, 2), row(60, 100, 3), row(100, 140, 3), row(160, 200, 2)],
      3,
      12
    )

    expect(rail?.basePath).toContain("L 0 40 Q 0 44")
    expect(rail?.basePath).toContain("Q 12 56 12 60")
    expect(rail?.basePath).toContain("L 12 140 Q 12 144")
    expect(rail?.basePath).toContain("Q 0 156 0 160")
  })

  it("keeps an active nested heading on the inner step", () => {
    const rail = buildOutlineRail(
      [row(0, 40, 2), row(60, 100, 3), row(120, 160, 2)],
      1,
      12
    )

    expect(rail?.activeSegment).toEqual({ top: 60, bottom: 100 })
  })

  it("highlights only the active parent heading", () => {
    const rail = buildOutlineRail(
      [row(0, 40, 2), row(60, 100, 3), row(100, 140, 3), row(160, 200, 2)],
      0,
      12
    )

    expect(rail?.activeSegment).toEqual({ top: 0, bottom: 40 })
  })

  it("keeps both active rows full length around an indented bend", () => {
    const rows = [row(0, 40, 2), row(60, 100, 3)]
    const parentRail = buildOutlineRail(rows, 0, 18)
    const childRail = buildOutlineRail(rows, 1, 18)

    expect(parentRail?.activeSegment).toEqual({ top: 0, bottom: 40 })
    expect(parentRail?.basePath).toContain("L 0 40 Q 0 44")
    expect(childRail?.activeSegment).toEqual({ top: 60, bottom: 100 })
  })

  it("keeps small bends within short segments", () => {
    const rail = buildOutlineRail([row(0, 8, 2), row(12, 20, 3)], 1, 12)

    expect(rail?.basePath).toContain("Q")
    expect(rail?.activeSegment).toEqual({ top: 12, bottom: 20 })
  })

  it("keeps the rail at the inner step when the list ends nested", () => {
    const rail = buildOutlineRail([row(0, 40, 2), row(60, 100, 3)], 1, 12)

    expect(rail?.basePath?.endsWith("L 12 100")).toBe(true)
  })
})
