import { act, fireEvent, render, screen } from "@testing-library/react"
import type { ComponentType } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  docsComponents,
  DocsFaq,
  DocsScreenshot,
} from "~/features/site/docs/docs-components"

type PendingAnimation = {
  cancel: ReturnType<typeof vi.fn>
  finish: () => void
  finished: Promise<void>
}

type DOMElementPrototype =
  | typeof HTMLElement.prototype
  | typeof HTMLImageElement.prototype

const pendingAnimations: PendingAnimation[] = []
const originalAnimateDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "animate"
)
const originalDecodeDescriptor = Object.getOwnPropertyDescriptor(
  HTMLImageElement.prototype,
  "decode"
)

const installAnimationMock = () => {
  const animate = vi.fn(
    (
      _keyframes: Keyframe[] | PropertyIndexedKeyframes,
      _options?: KeyframeAnimationOptions
    ) => {
      let resolveFinished = () => undefined
      const finished = new Promise<void>((resolve) => {
        resolveFinished = resolve
      })
      const animation = {
        cancel: vi.fn(),
        finish: () => resolveFinished(),
        finished,
      }
      pendingAnimations.push(animation)
      // SAFETY: the component only calls cancel() and awaits finished on this test double.
      return animation as Animation
    }
  )
  Object.defineProperty(HTMLElement.prototype, "animate", {
    configurable: true,
    value: animate,
    writable: true,
  })
  return animate
}

const stubImageDecode = (decode: () => Promise<void>) => {
  Object.defineProperty(HTMLImageElement.prototype, "decode", {
    configurable: true,
    value: decode,
    writable: true,
  })
}

const restoreDescriptor = (
  prototype: DOMElementPrototype,
  property: string,
  descriptor: PropertyDescriptor | undefined
) => {
  if (descriptor) {
    Object.defineProperty(prototype, property, descriptor)
  } else {
    Reflect.deleteProperty(prototype, property)
  }
}

beforeEach(() => {
  pendingAnimations.length = 0
})

afterEach(() => {
  restoreDescriptor(HTMLElement.prototype, "animate", originalAnimateDescriptor)
  restoreDescriptor(
    HTMLImageElement.prototype,
    "decode",
    originalDecodeDescriptor
  )
  vi.restoreAllMocks()
})

describe("DocsFaq", () => {
  it("uses the shared accordion disclosure for the question and answer", () => {
    render(
      <DocsFaq question="Why does my device not appear?">
        Keep Lynvo open on the device, then search again.
      </DocsFaq>
    )

    const question = screen.getByRole("button", {
      name: "Why does my device not appear?",
    })

    expect(question).toHaveAttribute("aria-expanded", "false")
    fireEvent.click(question)
    expect(question).toHaveAttribute("aria-expanded", "true")
    expect(
      screen.getByText("Keep Lynvo open on the device, then search again.")
    ).toBeInTheDocument()
    fireEvent.click(question)
    expect(question).toHaveAttribute("aria-expanded", "false")
  })

  it("anchors each question with a stable slug for deep links", () => {
    render(
      <DocsFaq question="Why does my device not appear?">
        Keep Lynvo open on the device.
      </DocsFaq>
    )

    expect(
      document.getElementById("faq-why-does-my-device-not-appear")
    ).not.toBeNull()
    expect(
      screen.getByRole("link", {
        name: "Link to Why does my device not appear?",
      })
    ).toHaveAttribute("href", "#faq-why-does-my-device-not-appear")
  })

  it("opens the question targeted by the location hash", () => {
    window.location.hash = "#faq-why-does-my-device-not-appear"

    try {
      render(
        <DocsFaq question="Why does my device not appear?">
          Keep Lynvo open on the device.
        </DocsFaq>
      )

      expect(
        screen.getByRole("button", { name: "Why does my device not appear?" })
      ).toHaveAttribute("aria-expanded", "true")
    } finally {
      window.history.replaceState(null, "", window.location.pathname)
    }
  })

  it("opens the question when its anchor link is clicked", () => {
    render(
      <DocsFaq question="Why does my device not appear?">
        Keep Lynvo open on the device.
      </DocsFaq>
    )

    fireEvent.click(
      screen.getByRole("link", {
        name: "Link to Why does my device not appear?",
      })
    )

    expect(
      screen.getByRole("button", { name: "Why does my device not appear?" })
    ).toHaveAttribute("aria-expanded", "true")
  })
})

describe("DocsInstallApps", () => {
  // SAFETY: this MDX key is registered with the DocsInstallApps component below.
  const InstallApps = docsComponents.DocsInstallApps as ComponentType<{
    apps?: string
  }>

  it("renders each store listing in the grid with its Google Play link", () => {
    render(<InstallApps />)

    expect(screen.getByRole("list")).toHaveClass("grid", "sm:grid-cols-2")
    expect(screen.getAllByRole("listitem")).toHaveLength(4)
    expect(
      screen.getByRole("link", { name: "View TV Bro on Google Play" })
    ).toHaveAttribute(
      "href",
      "https://play.google.com/store/apps/details?id=com.phlox.tvwebbrowser"
    )
    expect(
      screen.getByRole("link", {
        name: "View Just (Video) Player on Google Play",
      })
    ).toHaveAttribute(
      "href",
      "https://play.google.com/store/apps/details?id=com.brouken.player"
    )
    expect(
      screen.getByRole("link", { name: "View VLC for Android on Google Play" })
    ).toHaveAttribute(
      "href",
      "https://play.google.com/store/apps/details?id=org.videolan.vlc"
    )
    expect(
      screen.getByRole("link", { name: "View Google TV on Google Play" })
    ).toHaveAttribute(
      "href",
      "https://play.google.com/store/apps/details?id=com.google.android.videos"
    )
  })

  it("renders only the requested store listings", () => {
    render(<InstallApps apps="just-player vlc" />)

    expect(screen.getAllByRole("listitem")).toHaveLength(2)
    expect(
      screen.getByRole("link", {
        name: "View Just (Video) Player on Google Play",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "View VLC for Android on Google Play" })
    ).toBeInTheDocument()
  })
})

describe("DocsScreenshot", () => {
  it("throws when a screenshot asset is missing", () => {
    expect(() =>
      render(
        <DocsScreenshot
          name="example-screenshot-not-captured"
          alt="Settings > Player with Just (Video) Player selected"
        />
      )
    ).toThrow(
      "Documentation screenshot asset is missing: example-screenshot-not-captured"
    )
  })

  it("opens the screenshot zoomed in and closes it again", async () => {
    render(<DocsScreenshot name="settings-general" alt="Settings > General" />)

    fireEvent.click(
      screen.getByRole("button", { name: "Open image: Settings > General" })
    )

    expect(screen.getAllByAltText("Settings > General")).toHaveLength(2)

    fireEvent.click(screen.getAllByAltText("Settings > General")[1])

    expect(screen.getAllByAltText("Settings > General")).toHaveLength(1)
  })

  it("closes the zoomed screenshot from the keyboard", async () => {
    render(<DocsScreenshot name="settings-general" alt="Settings > General" />)

    const opener = screen.getByRole("button", {
      name: "Open image: Settings > General",
    })
    opener.focus()
    fireEvent.click(opener)

    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Close image: Settings > General" })
    )

    fireEvent.keyDown(window, { key: "Escape" })

    expect(screen.getAllByAltText("Settings > General")).toHaveLength(1)
    expect(document.activeElement).toBe(opener)
  })

  it("uses the Linear transform spring and releases the expanded layer", async () => {
    const animate = installAnimationMock()
    let resolveDecode: (() => void) | undefined
    const decodePromise = new Promise<void>((resolve) => {
      resolveDecode = resolve
    })
    stubImageDecode(() => decodePromise)
    vi.spyOn(
      HTMLButtonElement.prototype,
      "getBoundingClientRect"
    ).mockReturnValue(new DOMRect(80, 120, 600, 320))

    render(<DocsScreenshot name="settings-general" alt="Settings > General" />)

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Open image: Settings > General" })
      )
      resolveDecode?.()
      await decodePromise
    })

    expect(animate).toHaveBeenCalledTimes(2)

    expect(animate.mock.calls[0]?.[1]).toMatchObject({
      duration: 400,
      easing:
        "linear(0, 0.1803, 0.4551, 0.6711, 0.8122, 0.8966, 0.9445, 0.9708, 0.9848, 0.9922, 0.996, 0.998, 1)",
      fill: "both",
    })
    expect(animate.mock.calls[1]?.[1]).toMatchObject({
      duration: 250,
      easing: "cubic-bezier(0, 0, 0.58, 1)",
      fill: "both",
    })

    const overlay = document.querySelector(".docs-screenshot-zoom__overlay")
    const stage = screen.getByRole("dialog", { name: "Settings > General" })
    expect(overlay?.parentElement).toBe(stage.parentElement)
    expect(overlay?.contains(stage)).toBe(false)

    const closeButton = screen.getByRole("button", {
      name: "Close image: Settings > General",
    })
    await act(async () => {
      pendingAnimations[0]?.finish()
      await pendingAnimations[0]?.finished
    })
    expect(closeButton.style.willChange).toBe("auto")
  })

  it("stays closed when decoding finishes after an early close", async () => {
    let resolveDecode: (() => void) | undefined
    stubImageDecode(
      () =>
        new Promise<void>((resolve) => {
          resolveDecode = resolve
        })
    )
    vi.spyOn(
      HTMLButtonElement.prototype,
      "getBoundingClientRect"
    ).mockReturnValue(new DOMRect(80, 120, 600, 320))

    render(<DocsScreenshot name="settings-general" alt="Settings > General" />)

    const opener = screen.getByRole("button", {
      name: "Open image: Settings > General",
    })
    opener.focus()
    await act(async () => {
      fireEvent.click(opener)
    })
    const closeButton = screen.getByRole("button", {
      name: "Close image: Settings > General",
    })
    await act(async () => {
      fireEvent.click(closeButton)
    })

    expect(screen.getAllByAltText("Settings > General")).toHaveLength(1)
    await act(async () => {
      resolveDecode?.()
      await Promise.resolve()
    })
    expect(screen.getAllByAltText("Settings > General")).toHaveLength(1)
    expect(document.activeElement).toBe(opener)
  })

  it("retargets the close animation to the thumbnail after scrolling", async () => {
    const animate = installAnimationMock()
    let resolveDecode: (() => void) | undefined
    const decodePromise = new Promise<void>((resolve) => {
      resolveDecode = resolve
    })
    stubImageDecode(() => decodePromise)
    let thumbnailRect = new DOMRect(80, 120, 600, 320)
    vi.spyOn(
      HTMLButtonElement.prototype,
      "getBoundingClientRect"
    ).mockImplementation(() => thumbnailRect)

    render(<DocsScreenshot name="settings-general" alt="Settings > General" />)

    await act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Open image: Settings > General" })
      )
      resolveDecode?.()
      await decodePromise
    })
    expect(animate).toHaveBeenCalledTimes(2)
    await act(async () => {
      pendingAnimations[0]?.finish()
      await pendingAnimations[0]?.finished
    })

    const closeButton = screen.getByRole("button", {
      name: "Close image: Settings > General",
    })
    expect(closeButton.style.willChange).toBe("auto")

    thumbnailRect = new DOMRect(80, 420, 600, 320)
    await act(async () => {
      fireEvent.scroll(window)
      await Promise.resolve()
    })

    expect(animate).toHaveBeenCalledTimes(4)
    expect(animate.mock.calls[2]?.[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          transform: "scale(1) translate(0px, 300px)",
        }),
      ])
    )

    thumbnailRect = new DOMRect(80, 500, 600, 320)
    await act(async () => {
      fireEvent.scroll(window)
      await Promise.resolve()
    })
    expect(animate).toHaveBeenCalledTimes(6)
    expect(pendingAnimations[2]?.cancel).toHaveBeenCalled()

    await act(async () => {
      pendingAnimations[4]?.finish()
      await pendingAnimations[4]?.finished
    })
    expect(screen.getAllByAltText("Settings > General")).toHaveLength(1)
  })
})
