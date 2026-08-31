import { describe, expect, it } from "vitest"

import {
  createHeadingId,
  removeHtmlLikeTags,
} from "~/features/site/docs/docs-heading"

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
