import { act, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { LinkInputSection } from "~/components/send-link/LinkInputSection"

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

  it("detects a source link copied inside the app without refocusing", async () => {
    let clipboardText = ""
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { readText: vi.fn(() => Promise.resolve(clipboardText)) },
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

    clipboardText = "https://example.com/new-source"
    act(() => window.dispatchEvent(new Event("lynvo:clipboard-write")))

    await waitFor(() =>
      expect(screen.getByText(clipboardText)).toHaveClass("font-normal")
    )
    expect(screen.getByText(clipboardText)).not.toHaveClass("font-mono")
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
    expect(screen.getByText(/^from/)).toHaveTextContent(
      "from Example Plugin Server"
    )
    expect(screen.queryByText(/1\.1\.0/)).not.toBeInTheDocument()
    expect(
      Array.from(container.querySelectorAll("img"), (image) => image.src)
    ).toEqual([
      "https://plugin-server.example/icons/plugin-source-alpha.webp",
      "https://plugin-server.example/icons/plugin-source-beta.webp",
    ])
  })

  it("shows the Direct Link plugin icon without an icon card effect", () => {
    const { container } = render(
      <LinkInputSection
        url="https://media.example/video.mp4"
        setUrl={vi.fn()}
        onSave={vi.fn()}
        isSaving
        extractionPreview={{
          meta: {
            pluginId: "direct-link",
            pluginName: "Direct Link",
          },
        }}
        error={null}
        setError={vi.fn()}
      />
    )

    const helperRow = screen.getByText("Using").parentElement
    const icon = helperRow?.querySelector("svg")

    expect(icon).not.toHaveAttribute("data-icon-fallback")
    expect(icon).not.toHaveClass("ring-1")
    expect(icon).toHaveClass("text-foreground")
    expect(icon).not.toHaveClass("text-muted-foreground")
    expect(container.querySelector("img")).not.toBeInTheDocument()
  })
})
