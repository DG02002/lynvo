import { describe, expect, it } from "vitest"
import { createSaveListTestItems } from "~/features/links/testing/save-list-test-fixtures"
import { getLinkViewItemExtractedLinks } from "~/features/links/link-metadata-accessors"
import type { ExtractedLink } from "~/features/links/types"

const flattenLinks = (links: ExtractedLink[]): ExtractedLink[] =>
  links.flatMap((link) => [
    link,
    ...(link.children ? flattenLinks(link.children) : []),
  ])

describe("save-list UI test fixtures", () => {
  it("uses a realistic multi-item selection tree for drafts", () => {
    const draft = createSaveListTestItems().find(
      (item) => item.kind === "draft"
    )
    const links = draft?.meta.extractedLinks ?? []

    expect(links.length).toBeGreaterThan(1)
    expect(
      flattenLinks(links).filter((link) => link.type !== "folder").length
    ).toBeGreaterThanOrEqual(6)
  })

  it("contains no empty navigable folders", () => {
    const savedItems = createSaveListTestItems().filter(
      (item) => item.kind === "saved"
    )
    const savedLinks = savedItems.flatMap(getLinkViewItemExtractedLinks)
    const flattenedLinks = flattenLinks(savedLinks)

    expect(
      savedItems.some(
        (item) => getLinkViewItemExtractedLinks(item).length === 0
      )
    ).toBe(false)
    expect(
      flattenedLinks.some(
        (link) =>
          link.type === "folder" &&
          link.mediaNodeKind !== "resolvable" &&
          link.children?.length === 0
      )
    ).toBe(false)
  })

  it("includes Source Alpha playable items that resolve Resolver Beta mirrors when selected", () => {
    const mirrorItem = createSaveListTestItems().find(
      (item) => item.kind === "saved" && item.id === "source-alpha-mirrors"
    )
    const flattenedLinks = flattenLinks(
      mirrorItem ? getLinkViewItemExtractedLinks(mirrorItem) : []
    )

    expect(
      flattenedLinks.filter((link) => link.mediaNodeKind === "resolvable")
    ).toHaveLength(3)
  })
})
