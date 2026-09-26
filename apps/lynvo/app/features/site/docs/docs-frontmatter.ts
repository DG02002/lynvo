import { Result, Schema } from "effect"
import { parse as parseYaml } from "yaml"

const documentationFrontmatterSchema = Schema.Struct({
  title: Schema.String,
  description: Schema.String,
  navLabel: Schema.String,
  contentType: Schema.Literals([
    "Tutorial",
    "How-to",
    "Reference",
    "Conceptual",
  ]),
})

export type DocumentationFrontmatter = Schema.Schema.Type<
  typeof documentationFrontmatterSchema
>

const documentationFrontmatterPattern = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

const splitDocumentationFrontmatter = (source: string) => {
  const match = documentationFrontmatterPattern.exec(source)
  return match
    ? { serialized: match[1], content: source.slice(match[0].length) }
    : undefined
}

export const stripDocumentationFrontmatter = (source: string) =>
  splitDocumentationFrontmatter(source)?.content ?? source

export const parseDocumentationFrontmatter = (
  source: string,
  sourcePath: string
): DocumentationFrontmatter => {
  const frontmatter = splitDocumentationFrontmatter(source)
  if (!frontmatter) {
    throw new Error(`Documentation frontmatter is missing: ${sourcePath}`)
  }

  let parsedFrontmatter: unknown
  try {
    parsedFrontmatter = parseYaml(frontmatter.serialized)
  } catch (cause) {
    throw new Error(`Documentation frontmatter is invalid: ${sourcePath}`, {
      cause,
    })
  }

  const result = Schema.decodeUnknownResult(documentationFrontmatterSchema)(
    parsedFrontmatter
  )
  if (Result.isFailure(result)) {
    throw new Error(`Documentation frontmatter is invalid: ${sourcePath}`)
  }

  return result.success
}
