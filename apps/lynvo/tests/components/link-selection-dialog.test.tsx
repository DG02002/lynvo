import { useState } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { LinkSelectionDialog } from "~/components/send-link/LinkSelectionDialog"
import { attachResolvedChildren } from "~/features/links/link-tree-metadata"
import type { ExtractedLink } from "~/features/links/types"

interface LazyFolderHarnessProps {
  resolveFolder: () => Promise<ExtractedLink[]>
}

const LazyFolderHarness = ({ resolveFolder }: LazyFolderHarnessProps) => {
  const [links, setLinks] = useState<ExtractedLink[]>([
    {
      id: "lazy-folder",
      url: "https://drive.example/0:/lazy-folder/",
      label: "Lazy folder",
      type: "folder",
      selectable: true,
      children: [],
      childrenResolved: false,
    },
  ])

  return (
    <LinkSelectionDialog
      open
      onOpenChange={vi.fn()}
      links={links}
      onConfirm={vi.fn()}
      onExpandFolder={async (linkId, linkUrl) => {
        const resolvedChildren = await resolveFolder()
        setLinks((currentLinks) =>
          attachResolvedChildren({
            links: currentLinks,
            linkId,
            linkUrl,
            resolvedChildren,
          })
        )
        return resolvedChildren
      }}
    />
  )
}

describe("LinkSelectionDialog", () => {
  it("selects children discovered after a selected lazy folder is expanded", async () => {
    const resolveFolder = vi.fn().mockResolvedValue([
      {
        id: "video-one",
        url: "https://cdn.example/video-one.mkv",
        label: "Video One",
        type: "file",
      },
    ])
    render(<LazyFolderHarness resolveFolder={resolveFolder} />)

    fireEvent.click(screen.getByRole("checkbox"))
    fireEvent.click(screen.getByText("Lazy folder"))
    await screen.findByText("Video One")

    expect(screen.getAllByRole("checkbox")).toHaveLength(2)
    expect(
      screen
        .getAllByRole("checkbox")
        .every((item) => item.hasAttribute("data-checked"))
    ).toBe(true)
  })

  it("selects a lazy folder without expanding it when its checkbox is clicked", () => {
    const resolveFolder = vi.fn().mockResolvedValue([])
    render(<LazyFolderHarness resolveFolder={resolveFolder} />)

    fireEvent.click(screen.getByRole("checkbox"))

    expect(screen.getByRole("checkbox")).toBeChecked()
    expect(resolveFolder).not.toHaveBeenCalled()
    expect(
      screen.getByRole("treeitem", { name: /Lazy folder/ })
    ).toHaveAttribute("data-folder-state", "lazy-closed")
  })

  it("loads and expands a lazy folder when its row is opened", async () => {
    const resolveFolder = vi.fn().mockResolvedValue([
      {
        id: "video-one",
        url: "https://cdn.example/video-one.mkv",
        label: "Video One",
        type: "file",
        size: "2.4 GB",
      },
    ])
    render(<LazyFolderHarness resolveFolder={resolveFolder} />)

    fireEvent.click(screen.getByText("Lazy folder"))

    expect(await screen.findByText("Video One")).toBeVisible()
    expect(resolveFolder).toHaveBeenCalledTimes(1)
    expect(
      screen.getByRole("treeitem", { name: /Lazy folder/ })
    ).toHaveAttribute("aria-expanded", "true")
  })

  it("matches the save page responsive content width", () => {
    render(
      <LinkSelectionDialog
        open
        onOpenChange={vi.fn()}
        links={[]}
        onConfirm={vi.fn()}
      />
    )

    expect(screen.getByRole("dialog")).toHaveClass(
      "w-[calc(100vw-2rem)]",
      "md:w-[calc(100vw-4rem)]",
      "md:max-w-[60rem]"
    )
  })

  it("formats the page title and pipe-separated audio metadata", () => {
    render(
      <LinkSelectionDialog
        open
        onOpenChange={vi.fn()}
        links={[]}
        onConfirm={vi.fn()}
        pageTitle="The Midnight Romance in Hagwon (2024)"
        audioInfo="Hindi| English| Korean"
      />
    )

    expect(
      screen.getByRole("heading", {
        name: "The Midnight Romance in Hagwon (2024)",
      })
    ).toHaveClass("text-xl", "sm:text-2xl")
    expect(screen.getByText("Hindi, English, Korean")).toBeVisible()
    expect(screen.queryByText(/Audio:/)).not.toBeInTheDocument()
  })

  it("displays a working close button above the custom header", () => {
    const onOpenChange = vi.fn()
    render(
      <LinkSelectionDialog
        open
        onOpenChange={onOpenChange}
        links={[]}
        onConfirm={vi.fn()}
        pluginName="Spencerwooo's Onedrive Vercel Index"
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("saves a draft only when the explicit draft button is used", () => {
    const onOpenChange = vi.fn()
    const onSaveDraft = vi.fn()

    render(
      <LinkSelectionDialog
        open
        onOpenChange={onOpenChange}
        links={[
          {
            id: "playable-item-one",
            url: "https://cdn.example.com/playable-item-one.mkv",
            label: "Playable Item One",
            type: "file",
          },
          {
            id: "playable-item-two",
            url: "https://cdn.example.com/playable-item-two.mkv",
            label: "Playable Item Two",
            type: "file",
          },
        ]}
        onConfirm={vi.fn()}
        onSaveDraft={onSaveDraft}
        preSelectedIds={["playable-item-one"]}
      />
    )

    expect(onSaveDraft).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Save Draft" }))

    expect(onSaveDraft).toHaveBeenCalledWith()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
