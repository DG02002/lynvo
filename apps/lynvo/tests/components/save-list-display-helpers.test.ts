import {
  AlertCircleIcon,
  Folder01Icon,
  PlayIcon,
} from "@hugeicons/core-free-icons"
import { describe, expect, it } from "vitest"

import {
  getGallerySaveItemAriaLabel,
  getSaveListItemAriaLabel,
} from "~/components/save-list/item-aria-label"
import { getSaveListItemFallbackIcon } from "~/components/save-list/media-list-row"
import { getShouldCenterMobileNewBadge } from "~/components/save-list/new-badge"
import { compareByEpisodeNumber } from "~/components/save-list/save-list-browser-model"

describe("Save list display helpers", () => {
  it("compares episode numbers and falls back to original order", () => {
    expect(
      compareByEpisodeNumber(
        { label: "Show S01E12.mkv", originalIndex: 0 },
        { label: "Show S01E03.mkv", originalIndex: 1 }
      )
    ).toBeGreaterThan(0)

    expect(
      compareByEpisodeNumber(
        { label: "Pilot.mkv", originalIndex: 0 },
        { label: "Finale.mkv", originalIndex: 1 }
      )
    ).toBeLessThan(0)
  })

  it("selects the matching failed, loading, playable, or folder fallback", () => {
    expect(getSaveListItemFallbackIcon("failed", true)).toEqual({
      icon: AlertCircleIcon,
      isLoading: false,
      isExtractionVisual: true,
    })
    expect(getSaveListItemFallbackIcon("waiting", false)).toEqual({
      icon: Folder01Icon,
      isLoading: true,
      isExtractionVisual: true,
    })
    expect(getSaveListItemFallbackIcon("idle", true)).toEqual({
      icon: PlayIcon,
      isLoading: false,
      isExtractionVisual: false,
    })
    expect(getSaveListItemFallbackIcon("idle", false)).toEqual({
      icon: Folder01Icon,
      isLoading: false,
      isExtractionVisual: false,
    })
  })

  it("builds activation labels for Library rows and cards", () => {
    expect(
      getSaveListItemAriaLabel({
        itemTitle: "Saved show",
        directLink: undefined,
        isExtractionIncomplete: true,
        extractionStatusLabel: "Loading links…",
        isOpened: false,
        isNew: false,
      })
    ).toBe("Loading links… for Saved show")

    expect(
      getSaveListItemAriaLabel({
        itemTitle: "Saved show",
        directLink: {
          id: "episode",
          url: "https://media.example/episode.mkv",
          label: "Episode 1",
          type: "file",
          mediaNodeKind: "playable",
        },
        isExtractionIncomplete: false,
        extractionStatusLabel: "",
        isOpened: true,
        isNew: true,
      })
    ).toBe("Open Episode 1, new, opened")

    expect(
      getGallerySaveItemAriaLabel({
        groupTitle: "Saved show",
        isExtractionVisual: true,
        didExtractionFail: true,
        isSingleItem: true,
        itemTitle: "Saved show",
        hasDirectLink: false,
      })
    ).toBe("Open actions for Saved show")
    expect(
      getGallerySaveItemAriaLabel({
        groupTitle: "Saved show",
        isExtractionVisual: false,
        didExtractionFail: false,
        isSingleItem: true,
        itemTitle: "Saved show",
        hasDirectLink: false,
      })
    ).toBe("View Saved show")
  })

  it("centers the mobile badge only for stacked episode titles", () => {
    expect(getShouldCenterMobileNewBadge(true, "episode")).toBe(true)
    expect(getShouldCenterMobileNewBadge(true, "filename")).toBe(false)
    expect(getShouldCenterMobileNewBadge(false, "episode")).toBe(false)
  })
})
