import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { parseExtractSuccessContract } from "../src/index"
import { z } from "zod"

const documentedSuccessResponseSchema = z.looseObject({
  nodes: z.array(z.json()),
  extensions: z.record(z.string(), z.json()),
})

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
        const result = documentedSuccessResponseSchema.safeParse(
          JSON.parse(jsonBlock[1])
        )
        if (result.success) {
          expect(parseExtractSuccessContract(result.data).ok).toBe(true)
        }
      }
    }
  })

  it("documents static and fallback probe matching consistently", async () => {
    const routingDocumentationUrls = [
      new URL("../docs/spec.md", import.meta.url),
      new URL("../docs/author-guide.md", import.meta.url),
      new URL("../docs/compatibility-checklist.md", import.meta.url),
      new URL(
        "../../create-lynvo-plugin-server/template/README.md",
        import.meta.url
      ),
    ]

    for (const documentationUrl of routingDocumentationUrls) {
      const source = await readFile(documentationUrl, "utf8")
      expect(source).toContain("matchStrategy")
      expect(source).toContain("probe")
    }
  })
})
