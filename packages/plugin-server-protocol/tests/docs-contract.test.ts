import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import {
  PROTOCOL_ERROR_STATUS,
  parseExtractSuccessContract,
} from "../src/index"
import { Result, Schema } from "effect"

const documentedSuccessResponseSchema = Schema.Struct({
  nodes: Schema.Array(Schema.Unknown),
  extensions: Schema.Record(Schema.String, Schema.Unknown),
})

type DocumentationAssertion = "nodeIdentity" | "extractTarget" | "statusTable"

const documentationExpectations = new Map<
  URL,
  readonly DocumentationAssertion[]
>([
  [
    new URL("../docs/spec.md", import.meta.url),
    ["nodeIdentity", "statusTable"],
  ],
  [
    new URL("../docs/author-guide.md", import.meta.url),
    ["nodeIdentity", "extractTarget"],
  ],
  [
    new URL(
      "../../../apps/lynvo/app/features/site/docs/plugin-server/extraction-requests.mdx",
      import.meta.url
    ),
    ["nodeIdentity"],
  ],
  [
    new URL(
      "../../../apps/lynvo/app/features/site/docs/plugin-server/media-nodes.mdx",
      import.meta.url
    ),
    ["nodeIdentity"],
  ],
  [
    new URL(
      "../../../apps/lynvo/app/features/site/docs/plugin-server/hono-routes.mdx",
      import.meta.url
    ),
    ["extractTarget"],
  ],
  [
    new URL(
      "../../../apps/lynvo/app/features/site/docs/plugin-server/success-responses.mdx",
      import.meta.url
    ),
    [],
  ],
  [
    new URL(
      "../../../apps/lynvo/app/features/site/docs/plugin-server/agent-prompt.mdx",
      import.meta.url
    ),
    [],
  ],
])

const documentationUrls = [...documentationExpectations.keys()]

const documentationUrlsFor = (assertion: DocumentationAssertion): URL[] =>
  [...documentationExpectations.entries()]
    .filter(([, assertions]) => assertions.includes(assertion))
    .map(([documentationUrl]) => documentationUrl)

describe("published Plugin Server documentation", () => {
  it("keeps success responses aligned with the runtime schema", async () => {
    await Promise.all(
      documentationUrls.map(async (documentationUrl) => {
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
      })
    )
  })

  it("keeps the documented HTTP status table aligned with the protocol mapping", async () => {
    const [statusTableUrl] = documentationUrlsFor("statusTable")
    if (!statusTableUrl) {
      throw new Error("No documentation URL declares the status table")
    }
    const source = await readFile(statusTableUrl, "utf8")
    const [, statusTable = ""] = source.split("### HTTP status mapping\n")
    const rows = [
      ...(statusTable?.matchAll(/^\| `([^`]+)`\s+\|\s+(\d+)\s+\|$/gm) ?? []),
    ]
    const documentedStatuses = Object.fromEntries(
      rows.map(([, code, status]) => [code, Number(status)])
    )

    expect(documentedStatuses).toEqual(PROTOCOL_ERROR_STATUS)
  })

  it("documents URL and resource ID node identities on every guidance surface", async () => {
    await Promise.all(
      documentationUrlsFor("nodeIdentity").map(async (documentationUrl) => {
        const source = await readFile(documentationUrl, "utf8")
        expect(source).toContain("nodeUrl")
        expect(source).toContain("resourceId")
      })
    )
  })

  it("documents the discriminated extraction target on runtime guidance surfaces", async () => {
    await Promise.all(
      documentationUrlsFor("extractTarget").map(async (documentationUrl) => {
        const source = await readFile(documentationUrl, "utf8")
        expect(source).toContain("target.kind")
        expect(source).toContain("target.url")
        expect(source).toContain("resourceId")
      })
    )
  })
})
