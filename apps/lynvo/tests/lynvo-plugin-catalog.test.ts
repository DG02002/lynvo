import { describe, expect, it } from "vitest"
import { resolveLynvoPluginIconUrl } from "~/features/site/settings/lynvo-plugin-catalog.server"

describe("Lynvo plugin catalog icon URLs", () => {
  it("uses the request origin for development icons published on loopback", () => {
    expect(
      resolveLynvoPluginIconUrl(
        "http://localhost:5173/lynvo-plugin-server-assets/icons/sources/storage-index.webp",
        "http://192.168.1.3:5173/settings"
      )
    ).toBe(
      "http://192.168.1.3:5173/lynvo-plugin-server-assets/icons/sources/storage-index.webp"
    )
    expect(
      resolveLynvoPluginIconUrl(
        "http://localhost:5173/lynvo-plugin-server-assets/icons/sources/cloud-store-public-files.webp",
        "http://192.168.1.3:5173/settings#plugins"
      )
    ).toBe(
      "http://192.168.1.3:5173/lynvo-plugin-server-assets/icons/sources/cloud-store-public-files.webp"
    )
  })

  it("preserves externally hosted icon URLs", () => {
    expect(
      resolveLynvoPluginIconUrl(
        "https://cdn.lynvo.example/icons/sources/storage-index.webp",
        "https://lynvo.example/settings"
      )
    ).toBe("https://cdn.lynvo.example/icons/sources/storage-index.webp")
  })
})
