import { afterEach, describe, expect, it, vi } from "vitest"
import {
  LYNVO_PLUGIN_CATALOG,
  createLynvoPluginServerManifest,
  discoverLynvoPlugin,
  findLynvoPlugin,
} from "../src/plugin-catalog"
import { getLynvoManifestExtension } from "@dg02002/lynvo-plugin-server-protocol"

describe("Lynvo plugin catalog", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("generates manifest plugin metadata and dispatch from one catalog", () => {
    const manifest = createLynvoPluginServerManifest("https://lynvo.example")
    const extension = getLynvoManifestExtension(manifest)

    expect(extension.plugins?.map((plugin) => plugin.id)).toEqual(
      LYNVO_PLUGIN_CATALOG.map((plugin) => plugin.id)
    )
    expect(
      findLynvoPlugin(
        "https://drive.example/0:/Collections/",
        "bhadoo-google-drive-index"
      )?.id
    ).toBe("bhadoo-google-drive-index")
    expect(
      findLynvoPlugin("https://index.example/Collections/", "onedrive-index")
        ?.id
    ).toBe("onedrive-index")
    expect(
      findLynvoPlugin("https://drive.google.com/file/d/1AbCdEfGh123/view")?.id
    ).toBe("google-drive-public-files")
    expect(
      findLynvoPlugin("https://drive.google.com/drive/folders/1AbCdEfGh123")?.id
    ).toBe("google-drive-public-files")
  })

  it("publishes Direct Media as the fallback probe Plugin", () => {
    const manifest = createLynvoPluginServerManifest("https://lynvo.example")
    const directMedia = getLynvoManifestExtension(manifest).plugins?.find(
      (plugin) => plugin.id === "direct-media"
    )

    expect(directMedia).toMatchObject({
      id: "direct-media",
      displayName: "Direct Media",
      matchStrategy: "probe",
      hosts: [],
    })
    expect(directMedia?.matchers).toBeUndefined()
  })

  it("publishes only owned public icon URLs", () => {
    const extension = getLynvoManifestExtension(
      createLynvoPluginServerManifest("http://localhost:5173")
    )
    const bhadooPlugin = extension.plugins?.find(
      (plugin) => plugin.id === "bhadoo-google-drive-index"
    )
    expect(bhadooPlugin).toMatchObject({
      hasIcon: true,
      iconUrl: "http://localhost:5173/icons/sources/bhadoo-cloud.svg",
    })
    expect(
      extension.plugins?.find((plugin) => plugin.id === "onedrive-index")
    ).toMatchObject({
      hasIcon: true,
      iconUrl: "http://localhost:5173/icons/sources/onedrive-index.webp",
    })
    expect(
      extension.plugins?.find(
        (plugin) => plugin.id === "google-drive-public-files"
      )
    ).toMatchObject({
      hasIcon: true,
      iconUrl:
        "http://localhost:5173/icons/sources/google-drive-public-files.webp",
    })
    expect(
      extension.plugins?.find((plugin) => plugin.id === "direct-media")
    ).toMatchObject({
      hasIcon: true,
      iconUrl: "http://localhost:5173/icons/sources/direct-media.png",
    })
  })

  it("omits source icons when no public asset origin is configured", () => {
    const extension = getLynvoManifestExtension(
      createLynvoPluginServerManifest()
    )

    expect(
      extension.plugins?.every(
        (plugin) => plugin.hasIcon === false && plugin.iconUrl === undefined
      )
    ).toBe(true)
  })

  it("discovers a OneDrive index from its upstream repository link", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            '<html><a href="https://github.com/spencerwooo/onedrive-vercel-index">GitHub</a></html>',
            { status: 200 }
          )
        )
    )

    await expect(
      discoverLynvoPlugin("https://unknown.example/MEDIA/TV/Flames/")
    ).resolves.toEqual({
      matched: true,
      pluginId: "onedrive-index",
      confidence: "verified",
    })
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
