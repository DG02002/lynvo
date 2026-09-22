import { afterEach, describe, expect, it } from "vitest"

import {
  clearDismissedPluginDomainSuggestion,
  dismissPluginDomainSuggestion,
  getSavedLinkInteractionState,
  shouldOfferPluginDomainSuggestion,
} from "~/features/links/saved-link-interaction"
import type { LinkViewItem } from "~/features/links/types"

const createItem = (overrides: Partial<LinkViewItem> = {}): LinkViewItem => ({
  url: "https://example.com/item",
  timestamp: 1,
  metadata: {
    schemaVersion: 3,
    source: {},
    extraction: { extractedLinks: [] },
    playback: { openedUrls: [] },
  },
  ...overrides,
})

describe("saved link interaction", () => {
  afterEach(() => {
    sessionStorage.clear()
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
              mediaNodeKind: "playable",
            },
          ],
        },
        playback: { openedUrls: [] },
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
        playback: { openedUrls: [] },
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

  it("does not re-offer a dismissed Plugin Domain in the same session", async () => {
    const suggestion = {
      domain: "index.example.com",
      pluginServerId: "server",
      pluginId: "source",
      pluginName: "Source",
      sanitizedUrl: "https://index.example.com/Movies/",
    }

    dismissPluginDomainSuggestion(suggestion)

    await expect(
      shouldOfferPluginDomainSuggestion(suggestion, async () => {
        throw new Error("a dismissed suggestion should not list domains")
      })
    ).resolves.toBeUndefined()
  })

  it("allows a dismissed Plugin Domain to be offered after it is cleared", async () => {
    const suggestion = {
      domain: "index.example.com",
      pluginServerId: "server",
      pluginId: "source",
      pluginName: "Source",
      sanitizedUrl: "https://index.example.com/Movies/",
    }

    dismissPluginDomainSuggestion(suggestion)
    clearDismissedPluginDomainSuggestion(suggestion)

    await expect(
      shouldOfferPluginDomainSuggestion(suggestion, async () => [])
    ).resolves.toEqual(suggestion)
  })
})
