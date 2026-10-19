import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ComponentProps, ComponentType, ReactNode } from "react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { AppToaster } from "~/components/app-toaster"
import { toast } from "~/components/ui/toast"
import {
  docsComponents,
  DocsFaq,
  DocsScreenshot,
} from "~/features/site/docs/docs-components"

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

const restoreDescriptor = (
  target: Navigator | Window | Document,
  property: string,
  descriptor: PropertyDescriptor | undefined
) => {
  if (descriptor) {
    Object.defineProperty(target, property, descriptor)
  } else {
    Reflect.deleteProperty(target, property)
  }
}

afterEach(() => {
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
  afterEach(() => {
    toast.close()
  })

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
    render(
      <>
        <AppToaster />
        <CodeBlock label="terminal">
          <Pre>
            <code>{"pnpm dev\n"}</code>
          </Pre>
        </CodeBlock>
      </>
    )

    const copyButton = screen.getByRole("button", {
      name: "Copy code from terminal",
    })
    fireEvent.click(copyButton)

    await waitFor(() =>
      expect(copyButton.querySelector("svg.text-destructive")).toHaveClass(
        "scale-100",
        "opacity-100"
      )
    )
    expect(copyButton.querySelector("svg.text-destructive")).toBeInTheDocument()
    const errorToast = await screen.findByText(
      "terminal couldn’t be copied. Try again.",
      { selector: '[data-slot="toast-title"]' }
    )
    expect(errorToast.closest('[aria-live="polite"]')).toBeInTheDocument()
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
})
