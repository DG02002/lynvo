import { afterEach, describe, expect, it, vi } from "vitest"
import {
  ExtractorProtocolClient,
  ExtractorProtocolClientError,
  HttpExtractorTransport,
  ServiceBindingExtractorTransport,
  type ExtractorTransport,
} from "~/lib/extraction/extractor-protocol-client"
import { EXTRACTOR_REQUEST_TIMEOUT_MS } from "~/lib/constants"

const manifest = {
  protocolVersion: "1.0",
  extractorId: "com.example.extractor",
  displayName: "Example",
  auth: { type: "bearer" },
  usage: { endpoint: "/usage" },
  matchers: [{ hosts: ["source.example"] }],
  features: { basicAuth: true },
  extensions: {
    lynvo: {
      sources: [
        {
          id: "example",
          displayName: "Example",
          iconUrl: "https://source.example/icon.webp",
          status: "active",
          version: "1.0.0",
          hosts: ["source.example"],
        },
      ],
    },
  },
}

afterEach(() => vi.unstubAllGlobals())

describe("ExtractorProtocolClient", () => {
  it("allows the Official Extractor to finish its bounded retry budget", () => {
    expect(EXTRACTOR_REQUEST_TIMEOUT_MS).toBeGreaterThan(45_000)
  })

  it.each([
    ["HTTP", () => new HttpExtractorTransport("https://worker.example"), true],
    [
      "service binding",
      (transport: ExtractorTransport) =>
        new ServiceBindingExtractorTransport(transport),
      false,
    ],
  ])(
    "uses the same request contract over %s",
    async (_name, createTransport, rewritesOrigin) => {
      const requests: Request[] = []
      const transport: ExtractorTransport = {
        fetch: async (request) => {
          requests.push(request.clone())
          return request.url.endsWith("/manifest")
            ? Response.json(manifest)
            : Response.json({
                source: {
                  extractorId: "com.example.extractor",
                  displayName: "Example",
                },
                nodes: [],
                extensions: {},
              })
        },
      }
      if (rewritesOrigin) {
        vi.stubGlobal("fetch", transport.fetch)
      }
      const client = new ExtractorProtocolClient(createTransport(transport))

      await client.getManifest({ requestId: "request-1" })
      await client.extractSource("https://source.example/file", {
        apiKey: "secret",
        requestId: "request-2",
        basicAuth: { username: "viewer", password: "safe" },
      })

      expect(new URL(requests[0].url).hostname).toBe(
        rewritesOrigin ? "worker.example" : "extractor.internal"
      )
      expect(requests[0].headers.get("x-request-id")).toBe("request-1")
      expect(requests[1].headers.get("Authorization")).toBe("Bearer secret")
      expect(await requests[1].json()).toEqual({
        input: { kind: "source", sourceUrl: "https://source.example/file" },
        basicAuth: { username: "viewer", password: "safe" },
      })
    }
  )

  it("decodes protocol failures", async () => {
    const client = new ExtractorProtocolClient({
      fetch: async () =>
        Response.json(
          {
            ok: false,
            error: { code: "RATE_LIMITED", message: "Slow down" },
            extensions: {},
          },
          { status: 429 }
        ),
    })

    await expect(
      client.extractNode("https://source.example/file", {})
    ).rejects.toMatchObject<Partial<ExtractorProtocolClientError>>({
      code: "RATE_LIMITED",
      status: 429,
    })
  })

  it("sends structured credentials to standardized discovery", async () => {
    const requests: Request[] = []
    const client = new ExtractorProtocolClient({
      fetch: async (request) => {
        requests.push(request.clone())
        return Response.json({
          matched: true,
          sourceId: "example",
          confidence: "verified",
        })
      },
    })

    await expect(
      client.discover("https://source.example/path", {
        apiKey: "secret",
        basicAuth: { username: "viewer", password: "safe" },
      })
    ).resolves.toEqual({
      matched: true,
      sourceId: "example",
      confidence: "verified",
    })
    expect(await requests[0].json()).toEqual({
      url: "https://source.example/path",
      basicAuth: { username: "viewer", password: "safe" },
    })
  })
})
