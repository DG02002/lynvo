import { describe, expect, it } from "vitest"

import { cleanDocumentationMarkdown } from "~/features/site/docs/docs-markdown"

describe("documentation Markdown", () => {
  it("converts MDX notes into blockquotes", () => {
    expect(
      cleanDocumentationMarkdown(`<DocsNote title="Usage is authoritative">
Trust the server response.
</DocsNote>`)
    ).toBe("> **Usage is authoritative**\n>\n> Trust the server response.")
  })

  it("exports collapsible FAQs as a bold question and answer", () => {
    expect(
      cleanDocumentationMarkdown(
        '<DocsFaq question="Why is this link still loading?">Try refreshing the Saved link.</DocsFaq>'
      )
    ).toBe(
      "**Why is this link still loading?**\n\nTry refreshing the Saved link."
    )
  })

  it("omits screenshots when no asset resolver is available", () => {
    expect(
      cleanDocumentationMarkdown(
        '<DocsScreenshot name="settings-player" alt="Settings > Player showing VLC selected" />'
      )
    ).toBe("")
  })

  it("uses the available WebP extension in screenshot links", () => {
    expect(
      cleanDocumentationMarkdown(
        '<DocsScreenshot name="settings-player" alt="Player settings" />',
        () => "webp"
      )
    ).toBe("![Player settings](images/settings-player.webp)")
  })

  it("drops legacy screenshot captions instead of exporting them", () => {
    expect(
      cleanDocumentationMarkdown(
        '<DocsScreenshot name="settings-player" alt="Player settings">Player defaults</DocsScreenshot>',
        () => "png"
      )
    ).toBe("![Player settings](images/settings-player.png)")
  })

  it("cleans page source into Markdown instead of leaving raw MDX", () => {
    const markdown = cleanDocumentationMarkdown(
      `---\ntitle: Saving links\n---\n\n<DocSection id="faq">\n<DocsScreenshot name="saving-links-input" alt="Save page input" />\n<DocsFaq question="Why did Extraction fail?">Refresh the Saved link.</DocsFaq>\n</DocSection>`,
      () => "png"
    )

    expect(markdown).toContain("![Save page input]")
    expect(markdown).toContain("(images/saving-links-input.png)")
    expect(markdown).toContain(
      "**Why did Extraction fail?**\n\nRefresh the Saved link."
    )
    expect(markdown).not.toContain("---\ntitle: Saving links")
    expect(markdown).not.toContain("<DocsScreenshot")
    expect(markdown).not.toContain("<DocsFaq")
    expect(markdown).not.toContain("<DocSection")
  })
})
