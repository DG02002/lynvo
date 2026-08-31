import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { parseExtractSuccessContract } from "../src/index"
import { Result, Schema } from "effect"

const documentedSuccessResponseSchema = Schema.Struct({
  nodes: Schema.Array(Schema.Unknown),
  extensions: Schema.Record(Schema.String, Schema.Unknown),
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
        const parsedJson = JSON.parse(jsonBlock[1])
        const result = Schema.decodeUnknownResult(
          documentedSuccessResponseSchema
        )(parsedJson)
        if (Result.isSuccess(result)) {
          expect(parseExtractSuccessContract(parsedJson).ok).toBe(true)
        }
      }
    }
  })
})
