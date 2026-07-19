import { describe, expect, it } from "vitest"
import {
  createSourceExtractRequest,
  validateExtractSuccessContract,
  validateExtractorManifestContract,
  validateUsageContract,
} from "@lynvo/extractor-protocol"
import worker, { createManifest } from "../src/index"

const request = (path: string, init?: RequestInit): Request =>
  new Request(`https://extractor.example${path}`, init)

describe("extractor contract", () => {
  it("publishes a Lynvo-compatible manifest", () => {
    const result = validateExtractorManifestContract(
      createManifest(request("/manifest"))
    )

    expect(result.issues).toEqual([])
    expect(result.ok).toBe(true)
  })

  it("returns a protocol-compatible extract response", async () => {
    const response = await worker.fetch(
      request("/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          createSourceExtractRequest("https://example.com/files/demo")
        ),
      }),
      {}
    )
    const json = await response.json()
    const result = validateExtractSuccessContract(json)

    expect(response.status).toBe(200)
    expect(result.issues).toEqual([])
    expect(result.ok).toBe(true)
  })

  it("returns mandatory authenticated usage metrics", async () => {
    const response = await worker.fetch(request("/usage"), {})
    const result = validateUsageContract(await response.json())

    expect(response.status).toBe(200)
    expect(result.issues).toEqual([])
    expect(result.ok).toBe(true)
  })
})
