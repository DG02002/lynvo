import { SELF } from "cloudflare:test"
import { describe, expect, it } from "vitest"
import {
  validatePluginServerManifestContract,
  validateExtractSuccessContract,
  validateUsageContract,
} from "@lynvo/plugin-server-protocol"

const authenticatedHeaders = {
  Authorization: "Bearer test-api-key",
  "Content-Type": "application/json",
}

describe("official extractor protocol routes", () => {
  it("serves a public valid manifest", async () => {
    const response = await SELF.fetch("https://worker.example/manifest")
    const manifest: unknown = await response.json()

    expect(response.status).toBe(200)
    expect(validatePluginServerManifestContract(manifest)).toEqual({
      ok: true,
      issues: [],
    })
  })

  it("requires the configured bearer credential", async () => {
    const denied = await SELF.fetch("https://worker.example/verify", {
      method: "POST",
    })
    const accepted = await SELF.fetch("https://worker.example/verify", {
      method: "POST",
      headers: authenticatedHeaders,
    })

    expect(denied.status).toBe(401)
    expect(await denied.json()).toMatchObject({
      error: { code: "AUTH_INVALID" },
    })
    expect(accepted.status).toBe(200)
    expect(await accepted.json()).toEqual({ ok: true })
  })

  it("reports finite enforced usage", async () => {
    const response = await SELF.fetch("https://worker.example/usage", {
      headers: authenticatedHeaders,
    })
    const usage: unknown = await response.json()

    expect(response.status).toBe(200)
    expect(validateUsageContract(usage)).toEqual({ ok: true, issues: [] })
  })

  it("discovers Bhadoo URLs without Lynvo knowing their URL pattern", async () => {
    const response = await SELF.fetch("https://worker.example/discover", {
      method: "POST",
      headers: authenticatedHeaders,
      body: JSON.stringify({
        url: "https://unknown.example/0:/Collections/",
      }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      matched: true,
      pluginId: "bhadoo-google-drive-index",
      confidence: "pattern",
    })
  })

  it("does not claim unrelated URLs during discovery", async () => {
    const response = await SELF.fetch("https://worker.example/discover", {
      method: "POST",
      headers: authenticatedHeaders,
      body: JSON.stringify({ url: "https://unknown.example/movies/" }),
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ matched: false })
  })

  it("extracts a direct Bhadoo media node", async () => {
    const response = await SELF.fetch("https://worker.example/extract", {
      method: "POST",
      headers: authenticatedHeaders,
      body: JSON.stringify({
        pluginId: "bhadoo-google-drive-index",
        input: {
          kind: "source",
          sourceUrl: "https://drive.example/0:/Collections/example.mkv?a=view",
        },
      }),
    })
    const result: unknown = await response.json()

    expect(response.status).toBe(200)
    expect(validateExtractSuccessContract(result)).toEqual({
      ok: true,
      issues: [],
    })
    expect(result).toMatchObject({
      plugin: { pluginId: "bhadoo-google-drive-index" },
      nodes: [{ kind: "playable", label: "example.mkv" }],
    })
  })

  it("returns a protocol envelope for unknown routes", async () => {
    const response = await SELF.fetch("https://worker.example/unknown")
    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "BAD_REQUEST" },
    })
  })
})
