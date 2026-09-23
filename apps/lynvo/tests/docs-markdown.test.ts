import { describe, expect, it } from "vitest"

import {
  assembleDocumentationMarkdown,
  cleanDocumentationMarkdown,
} from "~/features/site/docs/docs-markdown"

describe("documentation Markdown", () => {
  it("returns the complete composed Plugin Server guide", () => {
    const markdown = assembleDocumentationMarkdown({
      title: "Build a Custom Plugin Server",
      description: "Build and connect a server.",
      introduction: "Start with the generated project.",
      sections: [
        {
          title: "Configure bearer authentication",
          content: `---
title: Authentication
---

<DocSection id="authentication">

Configure the bearer key.

</DocSection>`,
        },
        {
          title: "Connect the Plugin Server to Lynvo",
          content: "Run `pnpm wrangler deploy`.",
        },
      ],
    })

    expect(markdown).toContain("# Build a Custom Plugin Server")
    expect(markdown).toContain("## Configure bearer authentication")
    expect(markdown).toContain("## Connect the Plugin Server to Lynvo")
    expect(markdown).toContain("pnpm wrangler deploy")
    expect(markdown).not.toContain("import WhatIsAPluginServer")
    expect(markdown).not.toContain("<WhatIsAPluginServer")
    expect(markdown).not.toContain("<DocSection")
  })

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

  it("exports screenshot alt text and the expected image path", () => {
    expect(
      cleanDocumentationMarkdown(
        '<DocsScreenshot name="settings-player" alt="Settings > Player showing VLC selected">Player settings</DocsScreenshot>'
      )
    ).toBe(
      "![Settings > Player showing VLC selected](images/settings-player.png)\n\n*Player settings*"
    )
  })

  it("uses the available WebP extension in screenshot links", () => {
    expect(
      cleanDocumentationMarkdown(
        '<DocsScreenshot name="settings-player" alt="Player settings">Player defaults</DocsScreenshot>',
        () => "webp"
      )
    ).toBe(
      "![Player settings](images/settings-player.webp)\n\n*Player defaults*"
    )
  })

  it("cleans page source into Markdown instead of leaving raw MDX", () => {
    const markdown = cleanDocumentationMarkdown(
      `---\ntitle: Saving links\n---\n\n<DocSection id="faq">\n<DocsScreenshot name="saving-links-input" alt="Save page input">Save a link</DocsScreenshot>\n<DocsFaq question="Why did Extraction fail?">Refresh the Saved link.</DocsFaq>\n</DocSection>`
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
