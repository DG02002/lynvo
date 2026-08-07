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
})
