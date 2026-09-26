import { readFileSync, readdirSync } from "node:fs"
import { basename, extname, join, resolve } from "node:path"

import { Result, Schema } from "effect"
import { describe, expect, it } from "vitest"

import { getDocumentationImageAsset } from "~/features/site/docs/docs-image-assets"

const docsDirectory = resolve("app/features/site/docs")
const docsImageDirectory = join(docsDirectory, "images")
const screenshotManifestPath = resolve("scripts/screenshot-manifest.json")

const collectScreenshotReferences = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      return collectScreenshotReferences(path)
    }
    if (!entry.name.endsWith(".mdx")) {
      return []
    }

    return [
      ...readFileSync(path, "utf8").matchAll(
        /<DocsScreenshot\s+name="([^"]+)"/g
      ),
    ].map(([, name]) => name)
  })

const documentationImageNames = readdirSync(docsImageDirectory)
  .filter((name) => /\.(png|webp)$/.test(name))
  .map((name) => basename(name, extname(name)))

const screenshotManifestSchema = Schema.Struct({
  shots: Schema.Array(Schema.Struct({ output: Schema.String })),
})
const screenshotManifestResult = Schema.decodeUnknownResult(
  screenshotManifestSchema
)(JSON.parse(readFileSync(screenshotManifestPath, "utf8")))
if (Result.isFailure(screenshotManifestResult)) {
  throw new Error("Documentation screenshot manifest has an invalid shape")
}
const screenshotManifest = screenshotManifestResult.success
const manifestDocumentationImageNames = screenshotManifest.shots
  .map(({ output }) => output)
  .filter((output) => output.startsWith("app/features/site/docs/images/"))
  .map((output) => basename(output, extname(output)))
const sortNames = (names: Iterable<string>) =>
  [...names].toSorted((first, second) => first.localeCompare(second))

describe("documentation image assets", () => {
  it("matches MDX screenshot references to image files and manifest outputs", () => {
    const referencedNames = new Set(collectScreenshotReferences(docsDirectory))

    expect(sortNames(referencedNames)).toEqual(
      sortNames(documentationImageNames)
    )
    expect(sortNames(referencedNames)).toEqual(
      sortNames(manifestDocumentationImageNames)
    )
  })

  it("resolves a WebP asset when no PNG asset exists", () => {
    expect(
      getDocumentationImageAsset("settings-player", {
        "./images/settings-player.webp": "/assets/settings-player.webp",
      })
    ).toEqual({
      extension: "webp",
      source: "/assets/settings-player.webp",
    })
  })

  it("prefers PNG when both supported extensions are present", () => {
    expect(
      getDocumentationImageAsset("settings-player", {
        "./images/settings-player.png": "/assets/settings-player.png",
        "./images/settings-player.webp": "/assets/settings-player.webp",
      })
    ).toEqual({
      extension: "png",
      source: "/assets/settings-player.png",
    })
  })
})
