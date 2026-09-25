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
    expect(rail?.activePath).toBe("M 0 0 L 0 40")
  })

  it("curves the base rail out and back around nested headings", () => {
    const rail = buildOutlineRail(
      [row(0, 40, 2), row(40, 80, 3), row(80, 120, 3), row(120, 160, 2)],
      3,
      12
    )

    expect(rail?.basePath?.startsWith("M 0 0")).toBe(true)
    expect(rail?.basePath).toContain("L 0 34 Q 0 40 6 40")
    expect(rail?.basePath).toContain("L 6 40 Q 12 40 12 46")
    expect(rail?.basePath).toContain("L 12 114 Q 12 120 6 120")
    expect(rail?.basePath).toContain("L 6 120 Q 0 120 0 126")
    expect(rail?.basePath?.endsWith("L 0 160")).toBe(true)
  })

  it("keeps an active nested heading on the inner step", () => {
    const rail = buildOutlineRail(
      [row(0, 40, 2), row(40, 80, 3), row(80, 120, 2)],
      1,
      12
    )

    expect(rail?.activePath).toBe("M 12 40 L 12 80")
  })

  it("extends an active parent heading along its nested children", () => {
    const rail = buildOutlineRail(
      [row(0, 40, 2), row(40, 80, 3), row(80, 120, 3), row(120, 160, 2)],
      0,
      12
    )

    expect(rail?.activePath?.startsWith("M 0 0")).toBe(true)
    expect(rail?.activePath).toContain("Q 12 40")
    expect(rail?.activePath).toContain("Q 12 120 6 120")
    expect(rail?.activePath?.endsWith("L 0 120")).toBe(true)
  })

  it("clamps the elbow radius on short segments", () => {
    const rail = buildOutlineRail([row(0, 8, 2), row(8, 16, 3)], 1, 12)

    expect(rail?.basePath).toContain("Q 0 8 4 8")
  })

  it("keeps the rail at the inner step when the list ends nested", () => {
    const rail = buildOutlineRail([row(0, 40, 2), row(40, 80, 3)], 1, 12)

    expect(rail?.basePath?.endsWith("L 12 80")).toBe(true)
  })
})
