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
  it("selects and clears every selectable link", () => {
    const onConfirm = vi.fn()
    render(
      <LinkSelectionDialog
        open
        onOpenChange={vi.fn()}
        links={[
          {
            id: "group",
            url: "",
            label: "Group",
            type: "folder",
            selectable: false,
            children: [
              {
                id: "video-one",
                url: "https://cdn.example/video-one.mkv",
                label: "Video One",
                type: "file",
              },
              {
                id: "video-two",
                url: "https://cdn.example/video-two.mkv",
                label: "Video Two",
                type: "file",
              },
            ],
          },
        ]}
        onConfirm={onConfirm}
      />
    )

    expect(screen.getByText("0 selected")).toBeVisible()
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Select all",
      })
    )
    expect(screen.getByText("2 selected")).toBeVisible()
    expect(screen.getAllByRole("checkbox")).toHaveLength(3)
    expect(
      screen
        .getAllByRole("checkbox")
        .every((checkbox) => checkbox.hasAttribute("data-checked"))
    ).toBe(true)

    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(onConfirm).toHaveBeenCalledWith([
      expect.objectContaining({ id: "video-one" }),
      expect.objectContaining({ id: "video-two" }),
    ])

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Select all",
      })
    )
    expect(screen.getByText("0 selected")).toBeVisible()
    expect(
      screen
        .getAllByRole("checkbox")
        .every((checkbox) => !checkbox.hasAttribute("data-checked"))
    ).toBe(true)
  })

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

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select Lazy folder" })
    )
    fireEvent.click(screen.getByText("Lazy folder"))
    await screen.findByText("Video One")

    expect(
      screen.getByRole("checkbox", { name: "Select Lazy folder" })
    ).toBeChecked()
    expect(
      screen.getByRole("checkbox", { name: "Select Video One" })
    ).toBeChecked()
  })

  it("selects a lazy folder without expanding it when its checkbox is selected", () => {
    const resolveFolder = vi.fn().mockResolvedValue([])
    render(<LazyFolderHarness resolveFolder={resolveFolder} />)

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select Lazy folder" })
    )

    expect(
      screen.getByRole("checkbox", { name: "Select Lazy folder" })
    ).toBeChecked()
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
      "h-svh",
      "w-screen",
      "rounded-none",
      "sm:w-[calc(100vw-2rem)]",
      "sm:rounded-4xl",
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
        pluginIcon="https://plugin-server.example/plugin.webp"
        pluginName="Example Plugin"
        pageTitle="Sample Collection (2024)"
        audioInfo="Hindi| English| Korean"
      />
    )

    expect(screen.getByText("Example Plugin")).toHaveClass(
      "text-lg",
      "md:text-xl",
      "leading-tight"
    )
    expect(screen.getByText("Example Plugin")).not.toHaveClass("leading-none")
    expect(
      document.querySelector(
        'img[src="https://plugin-server.example/plugin.webp"]'
      )
    ).toHaveClass("size-10", "md:size-12")
    expect(
      screen.getByRole("heading", {
        name: "Sample Collection (2024)",
      })
    ).toHaveClass("text-base", "sm:text-lg")
    expect(screen.getByText("Hindi, English, Korean")).toBeVisible()
    expect(screen.queryByText(/Audio:/)).not.toBeInTheDocument()
  })

  it("closes from the Cancel action without showing a close icon", () => {
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

    expect(
      screen.queryByRole("button", { name: "Close link selection" })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("uses the shared large dialog action size", () => {
    render(
      <LinkSelectionDialog
        open
        onOpenChange={vi.fn()}
        links={[]}
        onConfirm={vi.fn()}
      />
    )

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("h-13.5")
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass("h-13.5")
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveClass("flex-1")
    expect(screen.getByRole("button", { name: "Save" })).toHaveClass("flex-1")
  })

  it("does not reserve trailing metadata space when a row has none", () => {
    render(
      <LinkSelectionDialog
        open
        onOpenChange={vi.fn()}
        links={[
          {
            id: "folder-without-metadata",
            url: "https://drive.example/folder-without-metadata",
            label: "Folder without metadata",
            type: "folder",
          },
          {
            id: "file-with-size",
            url: "https://drive.example/file-with-size.mkv",
            label: "File with size",
            type: "file",
            size: "1.2 GB",
          },
        ]}
        onConfirm={vi.fn()}
      />
    )

    expect(
      screen.getByRole("treeitem", { name: /Folder without metadata/ })
    ).toHaveClass("grid-cols-[1.25rem_1.5rem_minmax(0,1fr)]")
    expect(
      screen.getByRole("treeitem", { name: /File with size/ })
    ).toHaveClass("grid-cols-[1.25rem_1.5rem_minmax(0,1fr)_4rem]")
  })
})
