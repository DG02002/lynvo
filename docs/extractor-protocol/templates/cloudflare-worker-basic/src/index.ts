import { Hono } from "hono"
import {
  createExtractorRuntime,
  type ExtractSuccessResponse,
  type ExtractorManifest,
} from "@lynvo/extractor-protocol"

interface Env {
  EXTRACTOR_API_KEY?: string
}

const EXTRACTOR_ID = "com.example.extractor"
const EXTRACTOR_NAME = "Example Extractor"
const SOURCE_ID = "example-source"

const publicOrigin = (request: Request): string | undefined => {
  const url = new URL(request.url)
  return url.protocol === "https:" ? url.origin : undefined
}

export const createManifest = (request: Request): ExtractorManifest => {
  const origin = publicOrigin(request)
  const sourceIconUrl = origin
    ? `${origin}/icons/plugins/example.webp`
    : undefined

  return {
    protocolVersion: "1.0",
    extractorId: EXTRACTOR_ID,
    displayName: EXTRACTOR_NAME,
    ...(sourceIconUrl ? { iconUrl: sourceIconUrl } : {}),
    auth: { type: "bearer" },
    usage: { endpoint: "/usage" },
    matchers: [
      {
        hosts: ["example.com"],
        pathPatterns: ["/files/**"],
        schemes: ["https"],
      },
    ],
    features: {
      password: false,
      lazyNodes: false,
    },
    extensions: {
      lynvo: {
        sources: [
          {
            id: SOURCE_ID,
            displayName: "Example Source",
            ...(sourceIconUrl ? { iconUrl: sourceIconUrl } : {}),
            status: "active",
            version: "1.0.0",
            hosts: ["example.com"],
            matchers: [
              {
                hosts: ["example.com"],
                pathPatterns: ["/files/**"],
                schemes: ["https"],
              },
            ],
          },
        ],
      },
    },
  }
}

const extractExample = (targetUrl: string): ExtractSuccessResponse => ({
  source: {
    extractorId: EXTRACTOR_ID,
    displayName: EXTRACTOR_NAME,
    sourceId: SOURCE_ID,
    sourceName: "Example Source",
    pageTitle: "Example file",
  },
  nodes: [
    {
      kind: "playable",
      id: "example-file",
      label: "Example file",
      url: targetUrl,
      status: "up",
    },
  ],
  extensions: {},
})

const runtime = createExtractorRuntime<Env>({
  manifest: ({ request }) => createManifest(request),
  auth: {
    validate: ({ request, env }) => {
      if (!env.EXTRACTOR_API_KEY) {
        return true
      }
      return (
        request.headers.get("Authorization") ===
        `Bearer ${env.EXTRACTOR_API_KEY}`
      )
    },
  },
  usage: () => ({
    metrics: [
      {
        id: "worker-operations",
        label: "Extractor operations",
        used: 0,
        limit: 100,
        unit: "operations",
        period: "daily",
        resetsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  }),
  extract: ({ targetUrl }) => extractExample(targetUrl),
})

const app = new Hono<{ Bindings: Env }>()

app.get("/manifest", (c) => runtime.handleManifest(c.req.raw, c.env))
app.post("/verify", (c) => runtime.handleVerify(c.req.raw, c.env))
app.get("/usage", (c) => runtime.handleUsage(c.req.raw, c.env))
app.post("/extract", (c) => runtime.handleExtract(c.req.raw, c.env))

export default app
