import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { extractSuccessSchema } from "../src/index"

const documentationUrls = [
  new URL("../docs/spec.md", import.meta.url),
  new URL("../docs/author-guide.md", import.meta.url),
  new URL(
    "../../../apps/lynvo/app/features/site/docs/plugin-server/success-responses.mdx",
    import.meta.url
  ),
  new URL(
    "../../../apps/lynvo/app/features/site/docs/plugin-server/agent-prompt.mdx",
    import.meta.url
  ),
]

describe("published Plugin Server documentation", () => {
  it("keeps success responses aligned with the runtime schema", async () => {
    for (const documentationUrl of documentationUrls) {
      const source = await readFile(documentationUrl, "utf8")
      expect(source).not.toMatch(/"source"\s*:/)
      expect(source).not.toMatch(/\bsource(?:Name|IconUrl)\b/)
      const jsonBlocks = [...source.matchAll(/```json[^\n]*\n([\s\S]*?)```/g)]
      for (const jsonBlock of jsonBlocks) {
        const value: unknown = JSON.parse(jsonBlock[1])
        if (
          typeof value === "object" &&
          value !== null &&
          "nodes" in value &&
          "extensions" in value
        ) {
          expect(extractSuccessSchema.safeParse(value).success).toBe(true)
        }
      }
    }
  })
})
