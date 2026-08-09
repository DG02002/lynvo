import { describe, expect, it } from "vitest"
import { links as rootLinks } from "~/root"

describe("font preloads", () => {
  it("only preloads Inter", () => {
    const rootPreloads = rootLinks().filter((link) => link.rel === "preload")

    expect(rootPreloads).toHaveLength(1)
    expect(rootPreloads[0]?.href).toContain("inter-latin-wght-normal")
  })
})
