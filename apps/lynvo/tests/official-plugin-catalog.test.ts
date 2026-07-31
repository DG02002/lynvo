import { describe, expect, it } from "vitest"
import { resolveOfficialPluginIconUrl } from "~/features/site/settings/official-plugin-catalog.server"

describe("official plugin catalog icon URLs", () => {
  it("uses the request origin for development icons published on loopback", () => {
    expect(
      resolveOfficialPluginIconUrl(
        "http://localhost:5173/lynvo-plugin-server-assets/icons/sources/onedrive-index.webp",
        "http://192.168.1.3:5173/settings"
      )
    ).toBe(
      "http://192.168.1.3:5173/lynvo-plugin-server-assets/icons/sources/onedrive-index.webp"
    )
    expect(
      resolveOfficialPluginIconUrl(
        "http://localhost:5173/lynvo-plugin-server-assets/icons/sources/google-drive-public-files.webp",
        "http://192.168.1.3:5173/settings#plugins"
      )
    ).toBe(
      "http://192.168.1.3:5173/lynvo-plugin-server-assets/icons/sources/google-drive-public-files.webp"
    )
  })

  it("preserves externally hosted icon URLs", () => {
    expect(
      resolveOfficialPluginIconUrl(
        "https://cdn.lynvo.example/icons/sources/onedrive-index.webp",
        "https://lynvo.example/settings"
      )
    ).toBe("https://cdn.lynvo.example/icons/sources/onedrive-index.webp")
  })
})
