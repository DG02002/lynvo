import { describe, expect, it } from "vitest"
import { Schema } from "effect"
import { createLinkMetadata } from "~/features/links/links.mapper"
import { linkMetadataSchema } from "~/features/links/storage-schemas"
import { getDemoSavedLinkSeeds } from "~/features/links/dev-demo-data"

describe("development demo data", () => {
  it("includes a real show with episode container sources in two folders", () => {
    const breakingBadSeed = getDemoSavedLinkSeeds().find(
      (seed) => seed.meta.title === "Breaking Bad"
    )

    expect(breakingBadSeed).toBeDefined()
    const seasonFolders = breakingBadSeed?.extractedLinks ?? []
    expect(seasonFolders).toHaveLength(2)
    expect(seasonFolders.every((folder) => folder.type === "folder")).toBe(true)

    const episodeContainers = seasonFolders.flatMap(
      (seasonFolder) => seasonFolder.children ?? []
    )
    expect(episodeContainers).toHaveLength(4)
    expect(
      episodeContainers.every(
        (episode) =>
          episode.type === "folder" &&
          episode.mediaNodeKind === "resolvable" &&
          episode.resolutionKind === "mirrors"
      )
    ).toBe(true)

    const metadata = createLinkMetadata({
      meta: breakingBadSeed!.meta,
      extractedLinks: breakingBadSeed!.extractedLinks,
    })
    expect(() =>
      Schema.decodeUnknownSync(linkMetadataSchema)(
        JSON.parse(JSON.stringify(metadata))
      )
    ).not.toThrow()
  })
})
