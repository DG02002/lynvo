import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { LinkInputSection } from "~/components/send-link/link-input-section"

describe("LinkInputSection", () => {
  it("presents an existing link as a warning", () => {
    render(
      <LinkInputSection
        url="https://example.com/file"
        setUrl={vi.fn()}
        onSave={vi.fn()}
        isSaving={false}
        extractionPreview={null}
        error="Link already exists on your account."
        setError={vi.fn()}
      />
    )

    expect(screen.getByText("Link already saved")).toBeVisible()
    expect(screen.getByLabelText("Link")).not.toHaveAttribute(
      "aria-invalid",
      "true"
    )
    expect(screen.getByLabelText("Link")).toHaveAttribute(
      "placeholder",
      "https://example.com/video"
    )
  })

  it("does not request clipboard access until the user allows it", async () => {
    const readText = vi.fn(() =>
      Promise.resolve("https://example.com/new-source")
    )
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText },
    })
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: {
        query: vi.fn(() =>
          Promise.resolve({
            state: "prompt",
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          })
        ),
      },
    })

    render(
      <LinkInputSection
        url=""
        setUrl={vi.fn()}
        onSave={vi.fn()}
        isSaving={false}
        extractionPreview={null}
        error={null}
        setError={vi.fn()}
      />
    )

    expect(
      screen.queryByLabelText("Enable clipboard suggestions")
    ).not.toBeInTheDocument()
    await waitFor(() => expect(navigator.permissions.query).toHaveBeenCalled())
    expect(readText).not.toHaveBeenCalled()

    fireEvent.focus(screen.getByLabelText("Link"))
    expect(readText).not.toHaveBeenCalled()

    fireEvent.click(screen.getByLabelText("Enable clipboard suggestions"))
    expect(screen.getByText("Paste links faster")).toBeVisible()
    fireEvent.click(
      screen.getByRole("button", { name: "Allow clipboard access" })
    )

    await waitFor(() =>
      expect(screen.getByText("https://example.com/new-source")).toHaveClass(
        "font-normal"
      )
    )
    expect(readText).toHaveBeenCalledTimes(1)
  })

  it("hides clipboard suggestions when clipboard permissions are unsupported", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText: vi.fn() },
    })
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: {
        query: vi.fn(() => Promise.reject(new TypeError("Unsupported name"))),
      },
    })

    render(
      <LinkInputSection
        url=""
        setUrl={vi.fn()}
        onSave={vi.fn()}
        isSaving={false}
        extractionPreview={null}
        error={null}
        setError={vi.fn()}
      />
    )

    await waitFor(() => expect(navigator.permissions.query).toHaveBeenCalled())
    expect(
      screen.queryByLabelText("Enable clipboard suggestions")
    ).not.toBeInTheDocument()
  })

  it("does not suggest a clipboard URL that is already saved", async () => {
    const savedUrl = "https://example.com/already-saved"
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText: vi.fn(() => Promise.resolve(savedUrl)) },
    })
    Object.defineProperty(navigator, "permissions", {
      configurable: true,
      value: {
        query: vi.fn(() =>
          Promise.resolve({
            state: "granted",
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
          })
        ),
      },
    })

    render(
      <LinkInputSection
        url=""
        setUrl={vi.fn()}
        onSave={vi.fn()}
        isSaving={false}
        extractionPreview={null}
        error={null}
        setError={vi.fn()}
        savedUrls={new Set([savedUrl])}
      />
    )

    await waitFor(() => expect(navigator.clipboard.readText).toHaveBeenCalled())
    expect(screen.queryByText(savedUrl)).not.toBeInTheDocument()
  })

  it("shows a routed source without exposing the plugin version", () => {
    const { container } = render(
      <LinkInputSection
        url="https://plugin-source-alpha.example/file"
        setUrl={vi.fn()}
        onSave={vi.fn()}
        isSaving
        extractionPreview={{
          meta: {
            sourceName: "Source Alpha",
            sourceIconUrl:
              "https://plugin-server.example/icons/plugin-source-alpha.webp",
            sourceVersion: "1.1.0",
            pluginName: "Example Plugin Server",
            routeSourceName: "Source Beta",
            routeSourceIconUrl:
              "https://plugin-server.example/icons/plugin-source-beta.webp",
          },
        }}
        error={null}
        setError={vi.fn()}
      />
    )

    expect(screen.getByText("Source Alpha")).toBeVisible()
    expect(screen.getByLabelText("Routes to Source Beta")).toBeVisible()
    expect(screen.getByText("Source Beta")).toBeVisible()
    expect(screen.getByText("Example Plugin Server")).toBeVisible()
    expect(screen.getByText("Plugin Server")).toBeVisible()
    expect(screen.getByText("Source")).toBeVisible()
    expect(screen.getByText("•••••")).toHaveClass("shimmer")
    expect(screen.getByText("Example Plugin Server")).toHaveClass("shimmer")
    expect(screen.getByText("Source Alpha")).toHaveClass("shimmer")
    expect(
      screen.getByRole("status", { name: /Source Alpha from/ })
    ).toHaveClass("max-w-lg")
    expect(screen.queryByText(/1\.1\.0/)).not.toBeInTheDocument()
    expect(
      Array.from(container.querySelectorAll("img"), (image) => image.src)
    ).toEqual([
      "https://plugin-server.example/icons/plugin-source-alpha.webp",
      "https://plugin-server.example/icons/plugin-source-beta.webp",
    ])
  })

  it("shows Direct Media as a Lynvo Plugin Server Plugin", () => {
    render(
      <LinkInputSection
        url="https://media.example/video.mp4"
        setUrl={vi.fn()}
        onSave={vi.fn()}
        isSaving
        extractionPreview={{
          meta: {
            pluginId: "direct-media",
            pluginName: "Lynvo Plugin Server",
            sourceName: "Direct Media",
          },
        }}
        error={null}
        setError={vi.fn()}
      />
    )

    expect(screen.getByText("Plugin Server")).toBeVisible()
    expect(screen.getByText("Lynvo Plugin Server")).toBeVisible()
    expect(screen.getByText("Source")).toBeVisible()
    expect(screen.getByText("Direct Media")).toBeVisible()
    expect(
      screen.getByRole("status", {
        name: "Direct Media from Lynvo Plugin Server",
      })
    ).toBeVisible()
  })

  it("uses a human-readable label for an unavailable Source", () => {
    render(
      <LinkInputSection
        url="https://source.example/video"
        setUrl={vi.fn()}
        onSave={vi.fn()}
        isSaving
        extractionPreview={{ meta: { sourceStatus: "down" } }}
        error={null}
        setError={vi.fn()}
      />
    )

    expect(screen.getByText("Unavailable")).toBeVisible()
    expect(screen.queryByText("DOWN")).not.toBeInTheDocument()
  })
})
