import { env } from "cloudflare:workers"
import { Schema } from "effect"
import { describe, expect, it, vi } from "vitest"

import { formatPlayableValidity } from "../../app/features/links/format-playable-expiry"
import { getGalleryGroups } from "../../app/features/links/media-artwork/gallery-grouping"
import { getSavedLinkInteractionState } from "../../app/features/links/saved-link-interaction"
import { linkMetadataSchema } from "../../app/features/links/storage-schemas"
import type {
  ExtractedLink,
  LinkMetadata,
  LinkViewItem,
} from "../../app/features/links/types"
import { getSaveDateGroupLabel } from "../../app/lib/save-date-groups"
import { SeedApiClient, seedDocsLinks } from "../../scripts/seed"
import { MediaArtworkResponseSchema } from "../../shared/api-contracts"
import app from "../../workers/app"

const SEED_TIME = Date.now()
const DAY_MS = 24 * 60 * 60 * 1_000

interface SavedLinkSnapshot {
  readonly id: string
  readonly url: string
  readonly title: string | null
  readonly metaJson: string
  readonly createdAt: number
  readonly extractionState: string
  readonly extractionError: string | null
}

interface LinksResponse {
  readonly links: readonly SavedLinkSnapshot[]
}

const LinksResponseSchema = Schema.Struct({
  links: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      url: Schema.String,
      title: Schema.NullOr(Schema.String),
      metaJson: Schema.String,
      createdAt: Schema.Number,
      extractionState: Schema.String,
      extractionError: Schema.NullOr(Schema.String),
    })
  ),
})

const readMetadata = (savedLink: SavedLinkSnapshot): LinkMetadata =>
  Schema.decodeUnknownSync(linkMetadataSchema)(JSON.parse(savedLink.metaJson))

const toLinkViewItem = (savedLink: SavedLinkSnapshot): LinkViewItem => {
  const item: LinkViewItem = {
    id: savedLink.id,
    url: savedLink.url,
    timestamp: savedLink.createdAt,
    metadata: readMetadata(savedLink),
  }
  if (savedLink.title) {
    item.title = savedLink.title
  }
  return item
}

const findMediaNode = (
  nodes: readonly ExtractedLink[] | undefined,
  label: string
): ExtractedLink | undefined => nodes?.find((node) => node.label === label)

const createApi = (overrides: Partial<Env> = {}): SeedApiClient => {
  // SAFETY: The Cloudflare test environment supplies the generated Env bindings; only the two local development flags are overridden.
  const environment = {
    ...env,
    ENVIRONMENT: "development",
    LYNVO_NO_AUTH: "true",
    ...overrides,
  } as Env
  const fetchFromWorker: typeof fetch = async (input, init) =>
    await app.fetch(new Request(input, init), environment)

  return new SeedApiClient("http://localhost:5173", fetchFromWorker)
}

describe("docs seed CLI Saved link fixtures", () => {
  it("converges through the same-origin API with stable links and dates", async () => {
    const api = createApi()
    const staleUrl = "https://stale.example.invalid/remove-me"
    await api.mutate({
      method: "POST",
      path: "/api/data/links/create-or-update",
      body: {
        operationId: crypto.randomUUID(),
        url: staleUrl,
        title: "Stale link",
        meta: JSON.stringify({
          schemaVersion: 3,
          source: {},
          extraction: { extractedLinks: [] },
          playback: { openedUrls: [], resolvedMirrors: {} },
        }),
      },
      retryWithOperationId: true,
    })

    const firstSeed = await seedDocsLinks(api, {
      seedTime: SEED_TIME,
      pluginServerId: "local-plugin-server",
    })
    const secondSeed = await seedDocsLinks(api, {
      seedTime: SEED_TIME,
      pluginServerId: "local-plugin-server",
    })
    const snapshot = await api.get<LinksResponse>(
      "/api/data/links",
      LinksResponseSchema
    )
    const firstIds = new Map(firstSeed.map((link) => [link.url, link.id]))
    const secondIds = new Map(secondSeed.map((link) => [link.url, link.id]))

    expect(snapshot.links).toHaveLength(29)
    expect(snapshot.links.some((link) => link.url === staleUrl)).toBe(false)
    expect(
      [...secondIds.entries()].toSorted(([leftUrl], [rightUrl]) =>
        leftUrl.localeCompare(rightUrl)
      )
    ).toEqual(
      [...firstIds.entries()].toSorted(([leftUrl], [rightUrl]) =>
        leftUrl.localeCompare(rightUrl)
      )
    )
    const dateByTitle = new Map(
      snapshot.links.map((link) => [link.title, link.createdAt])
    )
    expect(dateByTitle.get("TV Shows")).toBe(SEED_TIME - 12 * DAY_MS)
    expect(dateByTitle.get("Movies")).toBe(SEED_TIME - 12 * DAY_MS)
    expect(dateByTitle.get("12 Angry Men")).toBe(SEED_TIME)
    expect(dateByTitle.get("Taxi Driver")).toBe(SEED_TIME)
    expect(dateByTitle.get("Mindhunter")).toBe(SEED_TIME)
    expect(dateByTitle.get("When Life Gives You Tangerines")).toBe(SEED_TIME)
    expect(dateByTitle.get("The Prestige")).toBe(SEED_TIME - 4 * DAY_MS)
    expect(dateByTitle.get("Severance")).toBe(SEED_TIME - 4 * DAY_MS)
    expect(dateByTitle.get("The Godfather Part II")).toBe(
      SEED_TIME - 10 * DAY_MS
    )
    expect(dateByTitle.get("The Sopranos")).toBe(SEED_TIME - DAY_MS)
    expect(getSaveDateGroupLabel(SEED_TIME, SEED_TIME)).toBe("Today")

    const dateGroupCounts = new Map<string, number>()
    for (const link of snapshot.links) {
      const label = getSaveDateGroupLabel(link.createdAt, SEED_TIME)
      dateGroupCounts.set(label, (dateGroupCounts.get(label) ?? 0) + 1)
    }
    expect(dateGroupCounts.get("Today")).toBe(4)
    expect(
      [...dateGroupCounts.values()].toSorted((left, right) => left - right)
    ).toEqual([4, 6, 6, 6, 7])

    const todayGalleryGroups = getGalleryGroups(
      snapshot.links
        .filter((link) => link.createdAt === SEED_TIME)
        .map(toLinkViewItem)
    )
    expect(
      todayGalleryGroups
        .map(({ artworkRequest }) => artworkRequest?.title ?? "")
        .toSorted((left, right) => left.localeCompare(right))
    ).toEqual([
      "12 Angry Men",
      "Mindhunter",
      "Taxi Driver",
      "When Life Gives You Tangerines",
    ])
    expect(
      todayGalleryGroups
        .map(({ artworkRequest }) => artworkRequest?.mediaKind ?? "")
        .toSorted((left, right) => left.localeCompare(right))
    ).toEqual(["movie", "movie", "tv", "tv"])

    const weekdayGroup = getSaveDateGroupLabel(
      SEED_TIME - 2 * DAY_MS,
      SEED_TIME
    )
    expect(weekdayGroup).not.toBe("Today")
    expect(weekdayGroup).not.toBe("Older")
    expect(getSaveDateGroupLabel(SEED_TIME - 10 * DAY_MS, SEED_TIME)).toBe(
      "Older"
    )

    const tvLibrary = snapshot.links.find((link) => link.title === "TV Shows")
    const movieLibrary = snapshot.links.find((link) => link.title === "Movies")
    const prestige = snapshot.links.find(
      (link) => link.title === "The Prestige"
    )
    const expired = snapshot.links.find(
      (link) => link.title === "The Godfather Part II"
    )
    const failed = snapshot.links.find((link) => link.title === "The Sopranos")
    const sandmanSeasons = snapshot.links.filter(
      (link) => link.title === "The Sandman"
    )
    expect(sandmanSeasons).toHaveLength(2)
    expect(
      sandmanSeasons.find((link) => link.url.endsWith("Season%2001/"))
        ?.createdAt
    ).toBe(SEED_TIME - 2 * DAY_MS)
    expect(
      sandmanSeasons.find((link) => link.url.endsWith("Season%2002/"))
        ?.createdAt
    ).toBe(SEED_TIME - 4 * DAY_MS)
    expect(tvLibrary).toBeDefined()
    expect(movieLibrary).toBeDefined()
    expect(expired).toBeDefined()
    expect(prestige).toBeDefined()
    expect(failed).toBeDefined()
    if (!tvLibrary || !movieLibrary || !prestige || !expired) {
      throw new Error(
        "The docs scenario is missing its TV library, movie library, The Prestige, or expired media fixture."
      )
    }
    const twelveAngryMen = snapshot.links.find(
      (link) => link.title === "12 Angry Men"
    )
    const twelveAngryMenMetadata =
      twelveAngryMen && readMetadata(twelveAngryMen)
    expect(twelveAngryMenMetadata?.playback.openedUrls).toContain(
      "https://media.example.invalid/lynvo-demo/12-angry-men-1957.mkv"
    )
    expect(
      getSavedLinkInteractionState(toLinkViewItem(tvLibrary), SEED_TIME).isNew
    ).toBe(true)
    expect(
      getSavedLinkInteractionState(toLinkViewItem(prestige), SEED_TIME).isNew
    ).toBe(true)
    const tvLibraryMetadata = readMetadata(tvLibrary)
    const movieLibraryMetadata = readMetadata(movieLibrary)
    expect(tvLibraryMetadata.playback.openedUrls).toEqual([])
    expect(tvLibraryMetadata.artwork).toBeUndefined()
    expect(tvLibraryMetadata).not.toHaveProperty("artworkPolicy")
    const tvLibraryNodes = tvLibraryMetadata.extraction.extractedLinks
    const mindhunterFolder = findMediaNode(tvLibraryNodes, "Mindhunter")
    const mindhunterSeasonOne = findMediaNode(
      mindhunterFolder?.children,
      "Season 01"
    )
    const mindhunterSeasonTwo = findMediaNode(
      mindhunterFolder?.children,
      "Season 02"
    )
    const sandmanFolder = findMediaNode(tvLibraryNodes, "The Sandman")
    const sandmanSeasonsInLibrary = sandmanFolder?.children
    const movieLibraryNodes = movieLibraryMetadata.extraction.extractedLinks
    expect(tvLibraryNodes.map((node) => node.label)).toEqual([
      "Mindhunter",
      "The Sandman",
    ])
    expect(mindhunterFolder?.children?.map((node) => node.label)).toEqual([
      "Season 01",
      "Season 02",
    ])
    expect(mindhunterSeasonOne?.children?.[0]?.label).toBe(
      "Mindhunter (2017) - S01E01 - Episode 1 - 1080p Blu-ray HEVC.mkv"
    )
    expect(mindhunterSeasonTwo?.mediaNodeKind).toBe("resolvable")
    expect(sandmanSeasonsInLibrary?.map((node) => node.label)).toEqual([
      "Season 01",
      "Season 02",
    ])
    expect(movieLibraryNodes.map((node) => node.label)).toEqual([
      "12 Angry Men (1957) - 2160p Blu-ray HEVC.mkv",
      "Taxi Driver (1976) - 1080p Blu-ray AVC.mkv",
    ])
    expect(movieLibraryNodes.some((node) => node.type === "folder")).toBe(false)
    const galleryGroups = getGalleryGroups(
      sandmanSeasons.map((link) => ({
        kind: "saved" as const,
        id: link.id,
        url: link.url,
        title: link.title ?? undefined,
        timestamp: link.createdAt,
        metadata: readMetadata(link),
      }))
    )
    expect(galleryGroups.map((group) => group.displayTitle).toSorted()).toEqual(
      ["The Sandman S01", "The Sandman S02"]
    )

    const failedMetadata = failed && readMetadata(failed)
    expect(failed?.extractionState).toBe("failed")
    expect(failed?.extractionError).toBe(
      "The Plugin could not resolve this Source URL."
    )
    expect(failedMetadata?.debugLog).toHaveLength(1)

    const severance = snapshot.links.find((link) => link.title === "Severance")
    const severanceMetadata = severance && readMetadata(severance)
    const severanceNode = severanceMetadata?.extraction.extractedLinks[0]
    expect(severanceNode).toMatchObject({
      label:
        "Severance (2022) - S02E03 - Who Is Alive? - 2160p Blu-ray HEVC HDR10.mkv",
      expiry: SEED_TIME + 3 * DAY_MS + 5 * 60 * 60 * 1_000 + 30 * 60 * 1_000,
    })
    expect(formatPlayableValidity(severanceNode?.expiry ?? 0, SEED_TIME)).toBe(
      "Link valid for 3d 5h"
    )
    const expiredMetadata = expired && readMetadata(expired)
    expect(
      formatPlayableValidity(
        expiredMetadata?.extraction.extractedLinks[0]?.expiry ?? 0,
        SEED_TIME
      )
    ).toBe("Link expired")

    const artworkApi = createApi({
      TMDB_API_READ_ACCESS_TOKEN: "docs-seed-test-token",
    })
    const artworkFetch = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              id: 987654,
              title: "Lynvo docs seeded poster test",
              release_date: "2026-01-01",
              poster_path: "/docs-seed-poster-test.jpg",
            },
          ],
        }),
        { headers: { "content-type": "application/json" } }
      )
    )
    try {
      const artwork = await artworkApi.mutateForResponse({
        method: "POST",
        path: "/api/data/media-artwork",
        body: {
          requests: [
            {
              mediaKind: "movie",
              title: "Lynvo docs seeded poster test",
              year: 2026,
            },
          ],
        },
        responseSchema: MediaArtworkResponseSchema,
      })
      expect(artwork.results[0]?.posterPath).toBe("/docs-seed-poster-test.jpg")
      expect(artworkFetch).toHaveBeenCalledOnce()
    } finally {
      artworkFetch.mockRestore()
    }
  })
})
