import { describe, expect, it } from "vitest"

import { getDocumentationImageAsset } from "~/features/site/docs/docs-image-assets"

describe("documentation image assets", () => {
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
