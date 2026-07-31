import { describe, expect, it } from "vitest"
import { resolveMetadataIconUrls } from "~/lib/extraction/metadata-icon-urls"

describe("resolveMetadataIconUrls", () => {
  it("uses the current LAN origin for official icons published on loopback", () => {
    expect(
      resolveMetadataIconUrls(
        {
          pluginName: "Lynvo Official Extractor",
          sourceName: "Google Drive Public Folders & Files",
          sourceIconUrl:
            "http://localhost:5173/official-extractor-assets/icons/sources/google-drive-public-files.webp",
        },
        "http://192.168.1.3:5173/save"
      ).sourceIconUrl
    ).toBe(
      "http://192.168.1.3:5173/official-extractor-assets/icons/sources/google-drive-public-files.webp"
    )
  })

  it("preserves externally hosted icon URLs", () => {
    expect(
      resolveMetadataIconUrls(
        {
          pluginName: "Example",
          sourceIconUrl: "https://cdn.example/icon.webp",
        },
        "http://192.168.1.3:5173/save"
      ).sourceIconUrl
    ).toBe("https://cdn.example/icon.webp")
  })
})
