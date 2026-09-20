import { fireEvent, render, screen } from "@testing-library/react"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"

import { LinkSelectionDialog } from "~/components/send-link/link-selection-dialog"
import { attachResolvedChildren } from "~/features/links/link-tree-metadata"
import type { ExtractedLink } from "~/features/links/types"

interface UnresolvedItemHarnessProps {
  resolveFolder: () => Promise<ExtractedLink[]>
}

const UnresolvedItemHarness = ({
  resolveFolder,
}: UnresolvedItemHarnessProps) => {
  const [links, setLinks] = useState<ExtractedLink[]>([
    {
      id: "lazy-folder",
      url: "https://drive.example/0:/lazy-folder/",
      label: "Unresolved item",
      mediaNodeKind: "resolvable",
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
            mediaNodeKind: "group",
            type: "folder",
            selectable: false,
            children: [
              {
                id: "video-one",
                url: "https://cdn.example/video-one.mkv",
                label: "Video One",
                mediaNodeKind: "playable",
                type: "file",
              },
              {
                id: "video-two",
                url: "https://cdn.example/video-two.mkv",
                label: "Video Two",
                mediaNodeKind: "playable",
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
    expect(screen.getAllByRole("checkbox")).toHaveLength(2)
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

  it("uses a non-selectable group checkbox to toggle its selectable children", () => {
    const onConfirm = vi.fn()
    render(
      <LinkSelectionDialog
        open
        onOpenChange={vi.fn()}
        links={[
          {
            nodeKey: "0:group:season-one",
            id: "season-one",
            label: "Season 1",
            mediaNodeKind: "group",
            type: "folder",
            selectable: false,
            children: [
              {
                nodeKey: "0.0:group:quality-folder",
                id: "quality-folder",
                label: "2160p",
                mediaNodeKind: "group",
                type: "folder",
                selectable: true,
                children: [
                  {
                    nodeKey:
                      "0.0.0:playable:https://cdn.example/episode-one.mkv",
                    id: "episode-one",
                    url: "https://cdn.example/episode-one.mkv",
                    label: "Episode One",
                    mediaNodeKind: "playable",
                    type: "file",
                  },
                ],
              },
              {
                nodeKey: "0.1:playable:https://cdn.example/episode-two.mkv",
                id: "episode-two",
                url: "https://cdn.example/episode-two.mkv",
                label: "Episode Two",
                mediaNodeKind: "playable",
                type: "file",
              },
            ],
          },
        ]}
        onConfirm={onConfirm}
      />
    )

    const seasonRow = screen.getByRole("treeitem", { name: /Season 1/ })
    expect(seasonRow.parentElement).toHaveAttribute("role", "tree")
    expect(seasonRow).toHaveAttribute("aria-level", "1")
    expect(seasonRow).toHaveAttribute("aria-posinset", "1")
    expect(seasonRow).toHaveAttribute("aria-setsize", "1")
    expect(seasonRow).not.toHaveAttribute("tabindex")
    expect(seasonRow.firstElementChild).toHaveAttribute("tabindex", "0")
    expect(seasonRow.firstElementChild).toHaveClass("focus-visible:ring-2")
    fireEvent.click(seasonRow.firstElementChild!)
    expect(seasonRow).toHaveAttribute("aria-expanded", "true")
    const qualityFolderRow = screen.getByRole("treeitem", { name: /2160p/ })
    expect(qualityFolderRow.parentElement).toHaveAttribute("role", "group")
    expect(qualityFolderRow).toHaveAttribute("aria-level", "2")
    expect(qualityFolderRow).toHaveAttribute("aria-posinset", "1")
    expect(qualityFolderRow).toHaveAttribute("aria-setsize", "2")
    fireEvent.click(qualityFolderRow.firstElementChild!)
    expect(qualityFolderRow).toHaveAttribute("aria-expanded", "true")
    const episodeOneRow = screen.getByRole("treeitem", { name: /Episode One/ })
    expect(episodeOneRow).toHaveAttribute("aria-level", "3")
    expect(episodeOneRow).toHaveAttribute("aria-posinset", "1")
    expect(episodeOneRow).toHaveAttribute("aria-setsize", "1")

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Season 1" }))
    expect(screen.getByText("3 selected")).toBeVisible()
    expect(seasonRow).toHaveAttribute("aria-expanded", "true")
    expect(
      screen.getByRole("checkbox", { name: "Select 2160p" })
    ).toHaveAttribute("data-checked")
    expect(
      screen.getByRole("checkbox", { name: "Select Episode One" })
    ).toHaveAttribute("data-checked")
    expect(
      screen.getByRole("checkbox", { name: "Select Episode Two" })
    ).toHaveAttribute("data-checked")

    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(onConfirm).toHaveBeenCalledWith([
      expect.objectContaining({ id: "quality-folder" }),
      expect.objectContaining({ id: "episode-two" }),
    ])
  })

  it("does not expand a collapsed folder when its checkbox is selected", () => {
    render(
      <LinkSelectionDialog
        open
        onOpenChange={vi.fn()}
        links={[
          {
            id: "season-one",
            label: "Season 1",
            mediaNodeKind: "group",
            type: "folder",
            selectable: false,
            children: [
              {
                id: "episode-one",
                url: "https://cdn.example/episode-one.mkv",
                label: "Episode One",
                mediaNodeKind: "playable",
                type: "file",
              },
            ],
          },
        ]}
        onConfirm={vi.fn()}
      />
    )

    const seasonRow = screen.getByRole("treeitem", { name: /Season 1/ })
    expect(seasonRow).toHaveAttribute("aria-expanded", "false")

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Season 1" }))

    expect(screen.getByText("1 selected")).toBeVisible()
    expect(seasonRow).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByText("Episode One")).not.toBeInTheDocument()
  })

  it("does not expand selected child folders when their parent is opened", () => {
    render(
      <LinkSelectionDialog
        open
        onOpenChange={vi.fn()}
        links={[
          {
            id: "season-one",
            label: "Season 1",
            mediaNodeKind: "group",
            type: "folder",
            selectable: false,
            children: [
              {
                id: "quality-folder",
                label: "2160p",
                mediaNodeKind: "group",
                type: "folder",
                selectable: true,
                children: [
                  {
                    id: "episode-one",
                    url: "https://cdn.example/episode-one.mkv",
                    label: "Episode One",
                    mediaNodeKind: "playable",
                    type: "file",
                  },
                ],
              },
            ],
          },
        ]}
        onConfirm={vi.fn()}
      />
    )

    const seasonRow = screen.getByRole("treeitem", { name: /Season 1/ })
    fireEvent.click(screen.getByRole("checkbox", { name: "Select Season 1" }))
    fireEvent.click(seasonRow.firstElementChild!)

    const qualityFolderRow = screen.getByRole("treeitem", { name: /2160p/ })
    expect(qualityFolderRow).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByText("Episode One")).not.toBeInTheDocument()
  })

  it("toggles a file when its row is clicked or activated with the keyboard", () => {
    const onConfirm = vi.fn()
    render(
      <LinkSelectionDialog
        open
        onOpenChange={vi.fn()}
        links={[
          {
            id: "video-one",
            url: "https://cdn.example/video-one.mkv",
            label: "Video One",
            mediaNodeKind: "playable",
            type: "file",
          },
        ]}
        onConfirm={onConfirm}
      />
    )

    const fileRow = screen.getByRole("treeitem", { name: /Video One/ })
    fireEvent.click(fileRow.firstElementChild!)
    expect(screen.getByText("1 selected")).toBeVisible()

    fireEvent.click(screen.getByRole("button", { name: "Save" }))
    expect(onConfirm).toHaveBeenCalledWith([
      expect.objectContaining({ id: "video-one" }),
    ])

    fireEvent.keyDown(fileRow.firstElementChild!, { key: "Enter" })
    expect(screen.getByText("0 selected")).toBeVisible()
  })

  it("toggles every link when the Select all label text is clicked", () => {
    render(
      <LinkSelectionDialog
        open
        onOpenChange={vi.fn()}
        links={[
          {
            id: "video-one",
            url: "https://cdn.example/video-one.mkv",
            label: "Video One",
            mediaNodeKind: "playable",
            type: "file",
          },
          {
            id: "video-two",
            url: "https://cdn.example/video-two.mkv",
            label: "Video Two",
            mediaNodeKind: "playable",
            type: "file",
          },
        ]}
        onConfirm={vi.fn()}
      />
    )

    fireEvent.click(screen.getByText("Select all"))
    expect(screen.getByText("2 selected")).toBeVisible()

    fireEvent.click(screen.getByText("Select all"))
    expect(screen.getByText("0 selected")).toBeVisible()
  })

  it("selects children discovered after a selected unresolved item is expanded", async () => {
    const resolveFolder = vi.fn().mockResolvedValue([
      {
        id: "video-one",
        url: "https://cdn.example/video-one.mkv",
        label: "Video One",
        mediaNodeKind: "playable",
        type: "file",
      },
    ])
    render(<UnresolvedItemHarness resolveFolder={resolveFolder} />)

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select Unresolved item" })
    )
    fireEvent.click(screen.getByText("Unresolved item"))
    await screen.findByText("Video One")

    expect(
      screen.getByRole("checkbox", { name: "Select Unresolved item" })
    ).toBeChecked()
    expect(
      screen.getByRole("checkbox", { name: "Select Video One" })
    ).toBeChecked()
  })

  it("selects an unresolved item without expanding it when its checkbox is selected", () => {
    const resolveFolder = vi.fn().mockResolvedValue([])
    render(<UnresolvedItemHarness resolveFolder={resolveFolder} />)

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Select Unresolved item" })
    )

    expect(
      screen.getByRole("checkbox", { name: "Select Unresolved item" })
    ).toBeChecked()
    expect(resolveFolder).not.toHaveBeenCalled()
    expect(
      screen.getByRole("treeitem", { name: /Unresolved item/ })
    ).toHaveAttribute("data-folder-state", "lazy-closed")
  })

  it("loads and expands an unresolved item when its row is opened", async () => {
    let finishFolderResolution: ((links: ExtractedLink[]) => void) | undefined
    const resolveFolder = vi.fn(
      () =>
        new Promise<ExtractedLink[]>((resolve) => {
          finishFolderResolution = resolve
        })
    )
    render(<UnresolvedItemHarness resolveFolder={resolveFolder} />)

    fireEvent.click(screen.getByText("Unresolved item"))

    const folderTreeItem = screen.getByRole("treeitem", {
      name: /Unresolved item/,
    })
    expect(
      await screen.findByRole("status", { name: "Loading Unresolved item…" })
    ).toBeVisible()
    const resolvingSpinner = folderTreeItem.querySelector(
      '[data-slot="spinner"]'
    )
    expect(resolvingSpinner).toHaveClass("size-5")
    expect(resolvingSpinner?.parentElement).toBe(
      folderTreeItem.firstElementChild
    )

    finishFolderResolution?.([
      {
        id: "video-one",
        url: "https://cdn.example/video-one.mkv",
        label: "Video One",
        mediaNodeKind: "playable",
        type: "file",
        size: "2.4 GB",
      },
    ])
    expect(await screen.findByText("Video One")).toBeVisible()
    expect(resolveFolder).toHaveBeenCalledTimes(1)
    expect(folderTreeItem).toHaveAttribute("aria-expanded", "true")
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
        pluginName="Sample Cloud Drive Index"
      />
    )

    expect(
      screen.queryByRole("button", { name: "Close link selection" })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
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
            mediaNodeKind: "resolvable",
            type: "folder",
          },
          {
            id: "file-with-size",
            url: "https://drive.example/file-with-size.mkv",
            label: "File with size",
            mediaNodeKind: "playable",
            type: "file",
            size: "1.2 GB",
          },
        ]}
        onConfirm={vi.fn()}
      />
    )

    expect(
      screen.getByRole("treeitem", { name: /Folder without metadata/ })
        .firstElementChild
    ).toHaveClass("grid-cols-[1.25rem_1.5rem_minmax(0,1fr)]")
    expect(
      screen.getByRole("treeitem", { name: /File with size/ }).firstElementChild
    ).toHaveClass("grid-cols-[1.25rem_1.5rem_minmax(0,1fr)_4rem]")
  })
})
