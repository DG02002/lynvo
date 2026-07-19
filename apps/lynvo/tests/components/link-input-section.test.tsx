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

    expect(screen.getByText("Warning")).toBeVisible()
    expect(screen.queryByText("Error")).not.toBeInTheDocument()
    expect(screen.getByPlaceholderText("Paste link")).not.toHaveAttribute(
      "aria-invalid",
      "true"
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
        url="https://hubdrive.example/file"
        setUrl={vi.fn()}
        onSave={vi.fn()}
        isSaving
        extractionPreview={{
          meta: {
            sourceName: "HubDrive",
            sourceIconUrl: "https://extractor.example/icons/hubdrive.webp",
            sourceVersion: "1.1.0",
            pluginName: "PlnkExtractor",
            routeSourceName: "HubCloud",
            routeSourceIconUrl: "https://extractor.example/icons/hubcloud.webp",
          },
        }}
        error={null}
        setError={vi.fn()}
      />
    )

    expect(screen.getByText("HubDrive")).toBeVisible()
    expect(screen.getByLabelText("Routes to")).toBeVisible()
    expect(screen.getByText("HubCloud")).toBeVisible()
    expect(screen.getByText("PlnkExtractor")).toBeVisible()
    expect(screen.getByText(/^from/)).toHaveTextContent("from PlnkExtractor")
    expect(screen.queryByText(/1\.1\.0/)).not.toBeInTheDocument()
    expect(
      Array.from(container.querySelectorAll("img"), (image) => image.src)
    ).toEqual([
      "https://extractor.example/icons/hubdrive.webp",
      "https://extractor.example/icons/hubcloud.webp",
    ])
  })
})
