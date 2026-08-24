import { fireEvent, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { LayoutGuideOverlay } from "~/components/layout-guide-overlay"

describe("LayoutGuideOverlay", () => {
  let originalGetAnimations: typeof Element.prototype.getAnimations | undefined

  beforeEach(() => {
    originalGetAnimations = Element.prototype.getAnimations
    if (!originalGetAnimations) {
      Object.defineProperty(Element.prototype, "getAnimations", {
        configurable: true,
        value: () => [],
      })
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (!originalGetAnimations) {
      Reflect.deleteProperty(Element.prototype, "getAnimations")
    }
  })

  it("does not render animated card edges as duplicate guide lines", async () => {
    let isCardAnimating = true
    const targetRectangles = new Map([
      ["library-grid", new DOMRect(80, 100, 800, 600)],
      ["library-card", new DOMRect(86, 120, 380, 570)],
    ])
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function () {
        return (
          targetRectangles.get(this.dataset.layoutGuideTarget ?? "") ??
          new DOMRect()
        )
      }
    )
    vi.spyOn(Element.prototype, "getAnimations").mockImplementation(
      function () {
        if (
          this instanceof HTMLElement &&
          this.dataset.layoutGuideTarget === "library-card" &&
          isCardAnimating
        ) {
          // SAFETY: The test only needs the Animation.playState read by the overlay.
          return [{ playState: "running" } as Animation]
        }
        return []
      }
    )

    render(
      <>
        <div data-layout-guide-target="library-grid" />
        <div data-layout-guide-target="library-card" />
        <LayoutGuideOverlay surface="save" />
      </>
    )

    await waitFor(() => {
      expect(
        Array.from(
          document.querySelectorAll<HTMLElement>(
            '[data-layout-guide-line="vertical"]'
          ),
          (line) => line.style.left
        )
      ).toEqual(["80px", "880px"])
    })

    const card = document.querySelector<HTMLElement>(
      '[data-layout-guide-target="library-card"]'
    )
    expect(card).not.toBeNull()
    if (!card) {
      throw new Error("Expected the library card target to be rendered")
    }
    isCardAnimating = false
    fireEvent.animationEnd(card)

    await waitFor(() => {
      expect(
        Array.from(
          document.querySelectorAll<HTMLElement>(
            '[data-layout-guide-line="vertical"]'
          ),
          (line) => line.style.left
        )
      ).toEqual(["80px", "86px", "466px", "880px"])
    })
  })
})
