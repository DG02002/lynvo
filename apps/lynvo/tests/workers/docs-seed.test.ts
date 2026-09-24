import { env } from "cloudflare:workers"
import { Schema } from "effect"
import { describe, expect, it } from "vitest"

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

const createApi = (): SeedApiClient => {
  // SAFETY: The Cloudflare test environment supplies the generated Env bindings; only the two local development flags are overridden.
  const environment = {
    ...env,
    ENVIRONMENT: "development",
    LYNVO_NO_AUTH: "true",
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

    expect(snapshot.links).toHaveLength(7)
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
    expect(dateByTitle.get("Shows and movies")).toBe(SEED_TIME - 12 * DAY_MS)
    expect(dateByTitle.get("Severance")).toBe(SEED_TIME)
    expect(dateByTitle.get("Dune: Part Two")).toBe(SEED_TIME)
    expect(dateByTitle.get("Arrival")).toBe(SEED_TIME - 10 * DAY_MS)
    expect(dateByTitle.get("Season archive")).toBe(SEED_TIME - DAY_MS)
    expect(getSaveDateGroupLabel(SEED_TIME, SEED_TIME)).toBe("Today")
    const weekdayGroup = getSaveDateGroupLabel(
      SEED_TIME - 2 * DAY_MS,
      SEED_TIME
    )
    expect(weekdayGroup).not.toBe("Today")
    expect(weekdayGroup).not.toBe("Older")
    expect(getSaveDateGroupLabel(SEED_TIME - 10 * DAY_MS, SEED_TIME)).toBe(
      "Older"
    )

    const library = snapshot.links.find(
      (link) => link.title === "Shows and movies"
    )
    const dune = snapshot.links.find((link) => link.title === "Dune: Part Two")
    const arrival = snapshot.links.find((link) => link.title === "Arrival")
    const failed = snapshot.links.find(
      (link) => link.title === "Season archive"
    )
    const bearSeasons = snapshot.links.filter(
      (link) => link.title === "The Bear"
    )
    expect(bearSeasons).toHaveLength(2)
    expect(
      bearSeasons.find((link) => link.url.endsWith("Season%2001/"))?.createdAt
    ).toBe(SEED_TIME - 2 * DAY_MS)
    expect(
      bearSeasons.find((link) => link.url.endsWith("Season%2002/"))?.createdAt
    ).toBe(SEED_TIME - 4 * DAY_MS)
    expect(library).toBeDefined()
    expect(arrival).toBeDefined()
    expect(dune).toBeDefined()
    expect(failed).toBeDefined()
    if (!library || !dune) {
      throw new Error(
        "The docs scenario is missing its library or Dune fixture."
      )
    }
    const duneMetadata = dune && readMetadata(dune)
    expect(duneMetadata?.playback.openedUrls).toContain(
      "https://media.example.invalid/lynvo-demo/dune-part-two.mkv"
    )
    expect(
      getSavedLinkInteractionState(toLinkViewItem(library), SEED_TIME).isNew
    ).toBe(true)
    expect(
      getSavedLinkInteractionState(toLinkViewItem(dune), SEED_TIME).isNew
    ).toBe(false)
    const libraryMetadata = library && readMetadata(library)
    expect(libraryMetadata?.playback.openedUrls).toEqual([])
    expect(libraryMetadata?.artwork).toBeUndefined()
    const libraryNodes = libraryMetadata?.extraction.extractedLinks
    const tvShows = findMediaNode(libraryNodes, "TV Shows")
    const severanceFolder = findMediaNode(tvShows?.children, "Severance")
    const severanceSeasonTwo = findMediaNode(
      severanceFolder?.children,
      "Season 02"
    )
    const severanceSeasonThree = findMediaNode(
      severanceFolder?.children,
      "Season 03"
    )
    const bearFolder = findMediaNode(tvShows?.children, "The Bear")
    const moviesFolder = findMediaNode(libraryNodes, "Movies")
    expect(tvShows?.mediaNodeKind).toBe("group")
    expect(severanceFolder?.children?.map((node) => node.label)).toEqual([
      "Season 02",
      "Season 03",
    ])
    expect(severanceSeasonTwo?.children?.[0]?.label).toBe(
      "Severance S02E03.mkv"
    )
    expect(severanceSeasonThree?.mediaNodeKind).toBe("resolvable")
    expect(bearFolder?.children?.[0]?.label).toBe(
      "Season 02/The Bear S02E04.mkv"
    )
    expect(moviesFolder?.children?.[0]?.label).toBe("Dune Part Two (2024).mkv")
    const galleryGroups = getGalleryGroups(
      bearSeasons.map((link) => ({
        kind: "saved" as const,
        id: link.id,
        url: link.url,
        title: link.title ?? undefined,
        timestamp: link.createdAt,
        metadata: readMetadata(link),
      }))
    )
    expect(galleryGroups.map((group) => group.displayTitle).toSorted()).toEqual(
      ["The Bear S01", "The Bear S02"]
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
      label: "Severance S02E03.mkv",
      expiry: SEED_TIME + 3 * DAY_MS + 4 * 60 * 60 * 1_000 + 59 * 60 * 1_000,
    })
    expect(formatPlayableValidity(severanceNode?.expiry ?? 0, SEED_TIME)).toBe(
      "Link valid for 3d 4h"
    )
    const arrivalMetadata = arrival && readMetadata(arrival)
    expect(
      formatPlayableValidity(
        arrivalMetadata?.extraction.extractedLinks[0]?.expiry ?? 0,
        SEED_TIME
      )
    ).toBe("Link expired")
  })
})
