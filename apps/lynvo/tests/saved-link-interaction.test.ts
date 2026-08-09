import { describe, expect, it } from "vitest"
import {
  getDraftSelection,
  getSavedLinkInteractionState,
  shouldOfferPluginDomainSuggestion,
} from "~/features/links/saved-link-interaction"
import type { DraftListItem, LinkViewItem } from "~/features/links/types"

const createItem = (overrides: Partial<LinkViewItem> = {}): LinkViewItem => ({
  url: "https://example.com/item",
  timestamp: 1,
  metadata: {
    schemaVersion: 3,
    source: {},
    extraction: { extractedLinks: [] },
    playback: { openedIds: [], openedUrls: [] },
  },
  ...overrides,
})

describe("saved link interaction", () => {
  it("keeps draft selection behavior separate from saved-link refresh", () => {
    const item: DraftListItem = {
      kind: "draft",
      url: "https://example.com/item",
      timestamp: 1,
      title: "Draft source",
      expiresAt: 10,
      extractedLinks: [{ url: "https://files.example/a", label: "A" }],
      meta: { sourceName: "Draft source" },
    }

    expect(getDraftSelection(item)).toEqual({
      originalUrl: item.url,
      links: item.extractedLinks,
      meta: item.meta,
      isDraftMode: true,
    })
  })

  it("calculates direct-play eligibility from an explicit clock", () => {
    const item = createItem({
      metadata: {
        schemaVersion: 3,
        source: {},
        extraction: {
          extractedLinks: [
            {
              url: "https://files.example/a",
              label: "A",
              expiry: 100,
            },
          ],
        },
        playback: { openedIds: [], openedUrls: [] },
      },
    })

    expect(getSavedLinkInteractionState(item, 99)).toMatchObject({
      isDirectLinkExpired: false,
      isNew: true,
    })
    expect(getSavedLinkInteractionState(item, 100)).toMatchObject({
      isDirectLinkExpired: true,
      isNew: false,
    })
  })

  it("recognizes mirror-resolvable items as containers", () => {
    const item = createItem({
      metadata: {
        schemaVersion: 3,
        source: {},
        extraction: {
          extractedLinks: [
            {
              url: "https://resolver.example/a",
              label: "A",
              type: "folder",
              mediaNodeKind: "resolvable",
            },
          ],
        },
        playback: { openedIds: [], openedUrls: [] },
      },
    })

    expect(getSavedLinkInteractionState(item, 10)).toMatchObject({
      isResolvableContainer: true,
    })
  })

  it("offers a Plugin Domain only when the same mapping is not configured", async () => {
    const suggestion = {
      domain: "index.example.com",
      pluginServerId: "server",
      pluginId: "source",
      pluginName: "Source",
      sanitizedUrl: "https://index.example.com",
      username: "user",
      password: "secret",
    }

    await expect(
      shouldOfferPluginDomainSuggestion(suggestion, async () => [])
    ).resolves.toEqual(suggestion)
    await expect(
      shouldOfferPluginDomainSuggestion(suggestion, async () => [suggestion])
    ).resolves.toBeUndefined()
  })
})
