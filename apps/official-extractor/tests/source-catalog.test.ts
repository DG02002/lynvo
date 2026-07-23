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
    expect(
      findOfficialSource(
        "https://drive.example/0:/Collections/",
        "bhadoo-google-drive-index"
      )?.id
    ).toBe("bhadoo-google-drive-index")
    expect(
      findOfficialSource("https://index.example/Collections/", "onedrive-index")
        ?.id
    ).toBe("onedrive-index")
  })

  it("publishes only owned public WebP icon URLs", () => {
    const extension = getLynvoManifestExtension(
      createOfficialManifest("http://localhost:5173")
    )
    const bhadooSource = extension.sources?.find(
      (source) => source.id === "bhadoo-google-drive-index"
    )
    expect(bhadooSource?.hasIcon).toBe(false)
    expect(bhadooSource?.iconUrl).toBeUndefined()
    expect(
      extension.sources?.find((source) => source.id === "onedrive-index")
    ).toMatchObject({
      hasIcon: true,
      iconUrl: "http://localhost:5173/icons/sources/onedrive-index.webp",
    })
  })

  it("omits source icons when no public asset origin is configured", () => {
    const extension = getLynvoManifestExtension(createOfficialManifest())

    expect(
      extension.sources?.every(
        (source) => source.hasIcon === false && source.iconUrl === undefined
      )
    ).toBe(true)
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
