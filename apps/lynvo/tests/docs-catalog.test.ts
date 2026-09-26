import { describe, expect, it } from "vitest"

import {
  createHeadingId,
  removeHtmlLikeTags,
} from "~/features/site/docs/docs-heading"
import {
  documentationSections,
  getDocumentationPageUrl,
  getDocumentationSectionKeyForPath,
  getDocumentationSlug,
} from "~/features/site/docs/docs-sections"

describe("documentation heading IDs", () => {
  it("does not retain malformed HTML-like tag delimiters", () => {
    expect(removeHtmlLikeTags("Use <script")).toBe("Use script")
    expect(removeHtmlLikeTags("Use >script")).toBe("Use script")
    expect(createHeadingId("Use <script")).toBe("use-script")
  })

  it("preserves visible text when removing complete tags", () => {
    expect(removeHtmlLikeTags("Use <em>safe</em>")).toBe("Use safe")
  })
})

describe("documentation sections", () => {
  it("assigns each content path to its section and drops its folder prefix from the slug", () => {
    expect(getDocumentationSectionKeyForPath("./general.mdx")).toBe("user")
    expect(getDocumentationSlug("./general.mdx")).toBe("general")

    expect(
      getDocumentationSectionKeyForPath("./plugin-server/manifest.mdx")
    ).toBe("developer")
    expect(getDocumentationSlug("./plugin-server/manifest.mdx")).toBe(
      "manifest"
    )
  })

  it("lets the same slug exist in both sections under different URLs", () => {
    expect(getDocumentationSlug("./plugins.mdx")).toBe("plugins")
    expect(getDocumentationSlug("./plugin-server/plugins.mdx")).toBe("plugins")
    expect(getDocumentationPageUrl("user", "plugins")).toBe("/docs/plugins")
    expect(getDocumentationPageUrl("developer", "plugins")).toBe(
      "/developer/plugins"
    )
  })

  it("gives every section a distinct root", () => {
    const roots = documentationSections.map((section) => section.root)

    expect(new Set(roots).size).toBe(documentationSections.length)
  })
})
