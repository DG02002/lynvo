import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentProps, ComponentType, ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  docsComponents,
  DocsFaq,
  DocsScreenshot,
} from "~/features/site/docs/docs-components"
import * as toastNotifications from "~/lib/toast-notifications"

type PendingAnimation = {
  cancel: ReturnType<typeof vi.fn>
  finish: () => void
  finished: Promise<void>
}

const pendingAnimations: PendingAnimation[] = []
const originalAnimateDescriptor = Object.getOwnPropertyDescriptor(
  HTMLElement.prototype,
  "animate"
)
const originalDecodeDescriptor = Object.getOwnPropertyDescriptor(
  HTMLImageElement.prototype,
  "decode"
)
const originalClipboardDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  "clipboard"
)
const originalSecureContextDescriptor = Object.getOwnPropertyDescriptor(
  window,
  "isSecureContext"
)
const originalExecCommandDescriptor = Object.getOwnPropertyDescriptor(
  document,
  "execCommand"
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
  target:
    | typeof HTMLElement.prototype
    | typeof HTMLImageElement.prototype
    | Navigator
    | Window
    | Document,
  property: string,
  descriptor: PropertyDescriptor | undefined
) => {
  if (descriptor) {
    Object.defineProperty(target, property, descriptor)
  } else {
    Reflect.deleteProperty(target, property)
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
  restoreDescriptor(navigator, "clipboard", originalClipboardDescriptor)
  restoreDescriptor(window, "isSecureContext", originalSecureContextDescriptor)
  restoreDescriptor(document, "execCommand", originalExecCommandDescriptor)
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

describe("CodeBlock", () => {
  // SAFETY: this MDX key is registered with the CodeBlock component below.
  const CodeBlock = docsComponents.CodeBlock as ComponentType<{
    label: string
    children: ReactNode
  }>
  // SAFETY: MDX renders fenced blocks through the pre override, so the test
  // composes the same mapping instead of a bare pre element.
  const Pre = docsComponents.pre as ComponentType<ComponentProps<"pre">>

  const stubClipboard = (
    writeTextImplementation: () => Promise<void> = () => Promise.resolve()
  ) => {
    const writeText = vi.fn(writeTextImplementation)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })
    return writeText
  }

  const setSecureContext = (isSecureContext: boolean) => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: isSecureContext,
    })
  }

  const stubLegacyClipboard = (didCopy: boolean) => {
    const execCommand = vi.fn(() => didCopy)
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      value: execCommand,
    })
    return execCommand
  }

  it("renders the label, the code, and a copy button", () => {
    render(
      <CodeBlock label="src/index.ts">
        <Pre>
          <code>{"const answer = 42\n"}</code>
        </Pre>
      </CodeBlock>
    )

    expect(screen.getByText("src/index.ts")).toBeInTheDocument()
    expect(screen.getByText("const answer = 42")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Copy code from src/index.ts" })
    ).toBeInTheDocument()
  })

  it("copies the code text and announces the copy", async () => {
    setSecureContext(true)
    const writeText = stubClipboard()

    const { container } = render(
      <CodeBlock label="terminal">
        <Pre>
          <code>{"pnpm dev\n"}</code>
        </Pre>
      </CodeBlock>
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Copy code from terminal" })
    )

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Copied terminal" })
      ).toBeInTheDocument()
    )
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent(
      "terminal copied"
    )
    expect(writeText).toHaveBeenCalledWith("pnpm dev\n")
  })

  it("falls back to text selection when the Clipboard API is unavailable", async () => {
    setSecureContext(true)
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    })
    const execCommand = stubLegacyClipboard(true)
    const { container } = render(
      <CodeBlock label="terminal">
        <Pre>
          <code>{"pnpm dev\n"}</code>
        </Pre>
      </CodeBlock>
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Copy code from terminal" })
    )

    await waitFor(() =>
      expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent(
        "terminal copied"
      )
    )
    expect(execCommand).toHaveBeenCalledWith("copy")
  })

  it("uses the fallback in insecure contexts", async () => {
    setSecureContext(false)
    const writeText = stubClipboard()
    const execCommand = stubLegacyClipboard(true)
    const { container } = render(
      <CodeBlock label="terminal">
        <Pre>
          <code>{"pnpm dev\n"}</code>
        </Pre>
      </CodeBlock>
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Copy code from terminal" })
    )

    await waitFor(() =>
      expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent(
        "terminal copied"
      )
    )
    expect(writeText).not.toHaveBeenCalled()
    expect(execCommand).toHaveBeenCalledWith("copy")
  })

  it("falls back to text selection when the Clipboard API rejects the copy", async () => {
    setSecureContext(true)
    const writeText = stubClipboard(() =>
      Promise.reject(new Error("Clipboard permission denied"))
    )
    const execCommand = stubLegacyClipboard(true)
    const { container } = render(
      <CodeBlock label="terminal">
        <Pre>
          <code>{"pnpm dev\n"}</code>
        </Pre>
      </CodeBlock>
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Copy code from terminal" })
    )

    await waitFor(() =>
      expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent(
        "terminal copied"
      )
    )
    expect(writeText).toHaveBeenCalledWith("pnpm dev\n")
    expect(execCommand).toHaveBeenCalledWith("copy")
  })

  it("shows a toast and red copy-button state when both clipboard paths fail", async () => {
    setSecureContext(true)
    const writeText = stubClipboard(() =>
      Promise.reject(new Error("Clipboard permission denied"))
    )
    const execCommand = stubLegacyClipboard(false)
    const showErrorToast = vi.spyOn(toastNotifications, "showErrorToast")
    render(
      <CodeBlock label="terminal">
        <Pre>
          <code>{"pnpm dev\n"}</code>
        </Pre>
      </CodeBlock>
    )

    const copyButton = screen.getByRole("button", {
      name: "Copy code from terminal",
    })
    fireEvent.click(copyButton)

    await waitFor(() =>
      expect(copyButton).toHaveAttribute("data-copy-state", "error")
    )
    expect(copyButton.querySelector("svg.text-destructive")).toBeInTheDocument()
    expect(copyButton).toHaveAttribute(
      "title",
      "terminal couldn’t be copied. Try again."
    )
    expect(showErrorToast).toHaveBeenCalledWith({
      title: "terminal couldn’t be copied. Try again.",
    })
    expect(writeText).toHaveBeenCalledWith("pnpm dev\n")
    expect(execCommand).toHaveBeenCalledWith("copy")
  })

  it("does nothing for an empty code block", async () => {
    setSecureContext(true)
    const writeText = stubClipboard()
    const execCommand = stubLegacyClipboard(true)
    const { container } = render(
      <CodeBlock label="terminal">
        <Pre>
          <code>{""}</code>
        </Pre>
      </CodeBlock>
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Copy code from terminal" })
    )

    expect(writeText).not.toHaveBeenCalled()
    expect(execCommand).not.toHaveBeenCalled()
    expect(
      container.querySelector('[aria-live="polite"]')
    ).toBeEmptyDOMElement()
  })

  it("keeps the highlighted code keyboard-scrollable with a focus ring", () => {
    const { container } = render(
      <CodeBlock label="terminal">
        <Pre className="shiki">
          <code>{"pnpm dev\n"}</code>
        </Pre>
      </CodeBlock>
    )

    const content = container.querySelector("pre")
    expect(content).toHaveAttribute("tabindex", "0")
    expect(content).toHaveAttribute("dir", "ltr")
    expect(content).toHaveClass(
      "focus-visible:ring-2",
      "focus-visible:ring-inset"
    )
    expect(content).not.toHaveAttribute("data-slot")
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
