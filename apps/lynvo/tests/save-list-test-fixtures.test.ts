import { describe, expect, it } from "vitest"
import { createSaveListTestItems } from "~/features/links/testing/save-list-test-fixtures"
import { getRecentLinkViewItemExtractedLinks } from "~/features/links/link-metadata-accessors"
import type { ExtractedLink } from "~/features/links/types"

const flattenLinks = (links: ExtractedLink[]): ExtractedLink[] =>
  links.flatMap((link) => [
    link,
    ...(link.children ? flattenLinks(link.children) : []),
  ])

describe("save-list UI test fixtures", () => {
  it("uses a realistic multi-item selection tree for drafts", () => {
    const draft = createSaveListTestItems().find((item) => item.isDraft)
    const links = draft ? getRecentLinkViewItemExtractedLinks(draft) : []

    expect(links.length).toBeGreaterThan(1)
    expect(
      flattenLinks(links).filter((link) => link.type !== "folder").length
    ).toBeGreaterThanOrEqual(6)
  })

  it("contains no empty navigable folders", () => {
    const savedItems = createSaveListTestItems().filter((item) => !item.isDraft)
    const savedLinks = savedItems.flatMap(getRecentLinkViewItemExtractedLinks)
    const flattenedLinks = flattenLinks(savedLinks)

    expect(
      savedItems.some(
        (item) => getRecentLinkViewItemExtractedLinks(item).length === 0
      )
    ).toBe(false)
    expect(
      flattenedLinks.some(
        (link) =>
          link.type === "folder" &&
          link.workerNodeKind !== "resolvable" &&
          link.children?.length === 0
      )
    ).toBe(false)
  })

  it("includes Source Alpha episodes that resolve Resolver Beta mirrors on click", () => {
    const mirrorItem = createSaveListTestItems().find(
      (item) => item.id === "source-alpha-mirrors"
    )
    const flattenedLinks = flattenLinks(
      mirrorItem ? getRecentLinkViewItemExtractedLinks(mirrorItem) : []
    )

    expect(
      flattenedLinks.filter((link) => link.workerNodeKind === "resolvable")
    ).toHaveLength(3)
  })
})
