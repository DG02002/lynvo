import { describe, expect, it } from "vitest"
import {
  OFFICIAL_SOURCE_CATALOG,
  createOfficialManifest,
  findOfficialSource,
} from "../src/source-catalog"
import { getLynvoManifestExtension } from "@lynvo/plugin-server-protocol"

describe("official source catalog", () => {
  it("generates manifest source metadata and dispatch from one catalog", () => {
    const manifest = createOfficialManifest("https://lynvo.example")
    const extension = getLynvoManifestExtension(manifest)

    expect(extension.plugins?.map((source) => source.id)).toEqual(
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
    expect(
      findOfficialSource("https://drive.google.com/file/d/1AbCdEfGh123/view")
        ?.id
    ).toBe("google-drive-public-files")
    expect(
      findOfficialSource("https://drive.google.com/drive/folders/1AbCdEfGh123")
        ?.id
    ).toBe("google-drive-public-files")
  })

  it("publishes only owned public WebP icon URLs", () => {
    const extension = getLynvoManifestExtension(
      createOfficialManifest("http://localhost:5173")
    )
    const bhadooSource = extension.plugins?.find(
      (source) => source.id === "bhadoo-google-drive-index"
    )
    expect(bhadooSource?.hasIcon).toBe(false)
    expect(bhadooSource?.iconUrl).toBeUndefined()
    expect(
      extension.plugins?.find((source) => source.id === "onedrive-index")
    ).toMatchObject({
      hasIcon: true,
      iconUrl: "http://localhost:5173/icons/sources/onedrive-index.webp",
    })
    expect(
      extension.plugins?.find(
        (source) => source.id === "google-drive-public-files"
      )
    ).toMatchObject({
      hasIcon: true,
      iconUrl:
        "http://localhost:5173/icons/sources/google-drive-public-files.webp",
    })
  })

  it("omits source icons when no public asset origin is configured", () => {
    const extension = getLynvoManifestExtension(createOfficialManifest())

    expect(
      extension.plugins?.every(
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
