import { describe, expect, it } from "vitest"
import {
  OFFICIAL_SOURCE_CATALOG,
  createOfficialManifest,
  findOfficialSource,
} from "../src/source-catalog"
import { getLynvoManifestExtension } from "@lynvo/extractor-protocol"

describe("official source catalog", () => {
  it("generates manifest source metadata and dispatch from one catalog", () => {
    const manifest = createOfficialManifest("https://lynvo.example")
    const extension = getLynvoManifestExtension(manifest)

    expect(extension.sources?.map((source) => source.id)).toEqual(
      OFFICIAL_SOURCE_CATALOG.map((source) => source.id)
    )
    expect(findOfficialSource("https://drive.example/0:/Shows/")?.id).toBe(
      "bhadoo-google-drive-index"
    )
    expect(findOfficialSource("https://index.example/Shows/")?.id).toBe(
      "onedrive-index"
    )
  })

  it("publishes only valid public WebP icon URLs", () => {
    const extension = getLynvoManifestExtension(
      createOfficialManifest("http://localhost:5173")
    )
    for (const source of extension.sources ?? []) {
      expect(source.iconUrl).toMatch(
        /^http:\/\/localhost:5173\/icons\/plugins\/.+\.webp$/
      )
    }
  })

  it("does not import application implementation modules", () => {
    const sourceModules = import.meta.glob("../src/**/*.ts", {
      query: "?raw",
      import: "default",
      eager: true,
    })
    for (const sourceText of Object.values(sourceModules)) {
      expect(sourceText).not.toContain("apps/lynvo")
      expect(sourceText).not.toContain('from "~/')
    }
  })
})
