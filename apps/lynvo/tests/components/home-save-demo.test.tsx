import { act, fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { HomeSaveDemo } from "~/features/site/home/home-save-demo"
import {
  HOME_DEMO_FINAL_STEP,
  HOME_DEMO_STEP,
  HOME_DEMO_STEP_DELAYS_MS,
} from "~/features/site/home/home-demo-constants"

describe("HomeSaveDemo", () => {
  it("keeps the library height stable without an empty item slot", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )

    const { container } = render(<HomeSaveDemo />)
    expect(
      screen.getByLabelText(
        "Animated preview of saving and removing a video link in Lynvo"
      )
    ).toBeInTheDocument()

    expect(
      screen
        .getByRole("button", { name: "Copy source link" })
        .closest("[data-demo-browser]")
    ).toBeNull()
    expect(screen.queryByText("Source link")).not.toBeInTheDocument()
    expect(container.querySelector(".home-demo-clipboard-slot")).toHaveClass(
      "min-h-10"
    )

    expect(container.querySelectorAll(".home-demo-library-item")).toHaveLength(
      3
    )
    expect(
      container.querySelector('[data-slot="input-group"]')
    ).toBeInTheDocument()
    expect(container.querySelector(".shimmer")).not.toBeInTheDocument()
    expect(
      container.querySelector(".home-demo-created-item")
    ).not.toBeInTheDocument()
  })

  it("starts the clipboard shimmer when the suggestion becomes visible", () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )

    try {
      const { container } = render(<HomeSaveDemo />)

      expect(container.querySelector(".shimmer")).not.toBeInTheDocument()

      for (const step of [
        HOME_DEMO_STEP.READY,
        HOME_DEMO_STEP.MOVE_TO_COPY_SOURCE,
        HOME_DEMO_STEP.COPY_SOURCE_LINK,
      ]) {
        act(() => {
          vi.advanceTimersByTime(HOME_DEMO_STEP_DELAYS_MS[step])
        })
      }

      expect(container.querySelector(".shimmer")).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it("shows paste and saving as separate, readable steps", () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )

    try {
      render(<HomeSaveDemo />)

      for (const step of [
        HOME_DEMO_STEP.READY,
        HOME_DEMO_STEP.MOVE_TO_COPY_SOURCE,
        HOME_DEMO_STEP.COPY_SOURCE_LINK,
      ]) {
        act(() => {
          vi.advanceTimersByTime(HOME_DEMO_STEP_DELAYS_MS[step])
        })
      }

      const clipboardButton = screen.getByRole("button", {
        name: "Paste clipboard link",
      })
      fireEvent.click(clipboardButton)

      expect(
        screen.queryByLabelText("Saving demo link…")
      ).not.toBeInTheDocument()
      expect(
        screen.queryByDisplayValue(
          "https://video.example/aurora-station-1080p.mp4"
        )
      ).not.toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(
          HOME_DEMO_STEP_DELAYS_MS[HOME_DEMO_STEP.PASTE_CLIPBOARD_LINK]
        )
      })

      expect(screen.getByLabelText("Saving demo link…")).toBeInTheDocument()
      expect(
        screen.getByDisplayValue(
          "https://video.example/aurora-station-1080p.mp4"
        )
      ).toBeInTheDocument()
      expect(clipboardButton).toHaveAttribute("aria-hidden", "true")

      act(() => {
        vi.advanceTimersByTime(
          HOME_DEMO_STEP_DELAYS_MS[HOME_DEMO_STEP.SAVING_LINK]
        )
      })

      expect(
        screen.queryByLabelText("Saving demo link…")
      ).not.toBeInTheDocument()
      expect(
        screen.getByText("Aurora Station — Episode 03 · 1080p")
      ).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  it("completes the copy, save, remove, and reset loop", () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }))
    )

    try {
      const { container } = render(<HomeSaveDemo />)
      const demo = () => container.querySelector(".home-save-demo")
      let currentStep = HOME_DEMO_STEP.READY
      const advanceStep = () => {
        act(() => {
          vi.advanceTimersByTime(HOME_DEMO_STEP_DELAYS_MS[currentStep])
        })
        currentStep += 1
      }

      advanceStep()
      expect(demo()).toHaveAttribute(
        "data-step",
        String(HOME_DEMO_STEP.MOVE_TO_COPY_SOURCE)
      )

      for (; currentStep < HOME_DEMO_STEP.ITEM_CREATED; currentStep += 1) {
        act(() => {
          vi.advanceTimersByTime(HOME_DEMO_STEP_DELAYS_MS[currentStep])
        })
      }

      expect(
        screen.getByText("Aurora Station — Episode 03 · 1080p")
      ).toBeInTheDocument()
      expect(demo()).toHaveAttribute("data-demo-item-created", "true")

      advanceStep()
      expect(demo()).toHaveAttribute("data-demo-item-created", "false")
      expect(screen.getByText("Copy Source link")).toBeInTheDocument()

      advanceStep()
      expect(screen.getByText("Remove saved link")).toBeInTheDocument()

      advanceStep()
      advanceStep()
      expect(screen.getByRole("dialog")).toHaveAccessibleName(
        "Remove this link?"
      )
      expect(
        screen.getByRole("dialog").closest("[data-demo-browser-content]")
      ).toBeInTheDocument()
      expect(
        container.querySelector("[data-demo-browser-toolbar]")
      ).not.toContainElement(screen.getByRole("dialog"))

      advanceStep()
      expect(screen.getByRole("dialog")).toBeInTheDocument()

      advanceStep()
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
      expect(demo()).toHaveAttribute("data-step", String(HOME_DEMO_FINAL_STEP))

      advanceStep()
      expect(demo()).toHaveAttribute("data-step", String(HOME_DEMO_STEP.READY))
    } finally {
      vi.useRealTimers()
    }
  })
})
