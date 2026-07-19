import {
  createExtractorRuntime,
  type ExtractorManifest,
} from "@lynvo/extractor-protocol"

export const manifest: ExtractorManifest = {
  protocolVersion: "1.0",
  extractorId: "dev.lynvo.example-extractor",
  displayName: "Example Extractor",
  auth: { type: "bearer" },
  usage: { endpoint: "/usage" },
  matchers: [{ hosts: ["media.example.com"] }],
  features: { password: false, lazyNodes: false },
  extensions: {
    lynvo: {
      sources: [
        {
          id: "example-media",
          displayName: "Example Media",
          status: "active",
          version: "1.0.0",
          hosts: ["media.example.com"],
        },
      ],
    },
  },
}

type ExampleEnvironment = Record<string, never>

const runtime = createExtractorRuntime<ExampleEnvironment>({
  manifest,
  auth: { validate: ({ request }) => request.headers.get("authorization") === "Bearer example-secret" },
  usage: () => ({ metrics: [] }),
  extract: ({ targetUrl }) => ({
    source: {
      extractorId: manifest.extractorId,
      displayName: manifest.displayName,
      sourceId: "example-media",
      sourceName: "Example Media",
    },
    nodes: [{ kind: "playable", label: "Example video", url: targetUrl }],
    extensions: {},
  }),
})

export default {
  fetch(request: Request, env: ExampleEnvironment): Promise<Response> {
    const pathname = new URL(request.url).pathname
    if (pathname === "/manifest") return runtime.handleManifest(request, env)
    if (pathname === "/verify") return runtime.handleVerify(request, env)
    if (pathname === "/usage") return runtime.handleUsage(request, env)
    if (pathname === "/extract") return runtime.handleExtract(request, env)
    return Promise.resolve(new Response("Not found", { status: 404 }))
  },
}
