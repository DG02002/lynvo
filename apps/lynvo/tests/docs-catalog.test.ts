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
  getDeveloperDocsRedirectSlugForSection,
  getMergedDeveloperDocsSlug,
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

  it("redirects every merged developer slug to its replacement page", () => {
    expect(getMergedDeveloperDocsSlug("extraction-requests")).toBe("extract")
    expect(getMergedDeveloperDocsSlug("media-nodes")).toBe("extract")
    expect(getMergedDeveloperDocsSlug("success-responses")).toBe("extract")
    expect(getMergedDeveloperDocsSlug("extract")).toBeUndefined()
  })

  it("dispatches redirects by documentation section", () => {
    expect(
      getDeveloperDocsRedirectSlugForSection("user", "plugin-server")
    ).toBe("")
    expect(
      getDeveloperDocsRedirectSlugForSection(
        "user",
        "plugin-server/media-nodes"
      )
    ).toBe("media-nodes")
    expect(
      getDeveloperDocsRedirectSlugForSection("developer", "media-nodes")
    ).toBe("extract")
    expect(
      getDeveloperDocsRedirectSlugForSection("developer", "extract")
    ).toBeUndefined()
  })

  it.each(["extraction-requests", "media-nodes", "success-responses"])(
    "redirects the merged %s page to extract",
    (slug) => {
      expect(getDeveloperDocsRedirectSlugForSection("developer", slug)).toBe(
        "extract"
      )
    }
  )

  it("leaves current pages without a redirect slug", () => {
    expect(
      getDeveloperDocsRedirectSlugForSection("developer", "extract")
    ).toBeUndefined()
  })
})
