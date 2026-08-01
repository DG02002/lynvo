import { Hono } from "hono"
import {
  createPluginServerRuntime,
  validPluginServerManifestFixture,
  validUsageResponseFixture,
  type PluginServerManifest,
} from "@lynvo/plugin-server-protocol"
import { extractExampleSource } from "./plugins/example.js"

export interface Env {
  LYNVO_PLUGIN_SERVER_API_KEY?: string
}

export const manifest = {
  ...validPluginServerManifestFixture,
  pluginServerId: "__PROJECT_SERVER_ID__",
  displayName: "__PROJECT_DISPLAY_NAME__",
  matchers: [{ hosts: ["media.example.com"] }],
  extensions: {
    lynvo: {
      plugins: [
        {
          id: "example-source",
          displayName: "Example Source",
          description: "Replace this example with your source implementation.",
          status: "active",
          version: "0.1.0",
          hosts: ["media.example.com"],
        },
      ],
    },
  },
} satisfies PluginServerManifest

const hasValidBearer = (request: Request, env: Env): boolean => {
  const authorization = request.headers.get("authorization")
  const expected = env.LYNVO_PLUGIN_SERVER_API_KEY
  if (!authorization || !expected) return false

  const match = /^Bearer\s+(.+)$/i.exec(authorization)
  if (!match) return false

  const actualBytes = new TextEncoder().encode(match[1])
  const expectedBytes = new TextEncoder().encode(expected)
  if (actualBytes.length !== expectedBytes.length) return false

  let difference = 0
  for (let index = 0; index < actualBytes.length; index += 1) {
    difference |= actualBytes[index] ^ expectedBytes[index]
  }
  return difference === 0
}

const runtime = createPluginServerRuntime<Env>({
  manifest,
  auth: {
    validate: ({ request, env }) => hasValidBearer(request, env),
  },
  usage: () => validUsageResponseFixture,
  extract: ({ targetUrl }) =>
    extractExampleSource(targetUrl, manifest.pluginServerId),
})

const app = new Hono<{ Bindings: Env }>()

app.get("/manifest", (context) =>
  runtime.handleManifest(context.req.raw, context.env)
)
app.post("/verify", (context) =>
  runtime.handleVerify(context.req.raw, context.env)
)
app.get("/usage", (context) =>
  runtime.handleUsage(context.req.raw, context.env)
)
app.post("/extract", (context) =>
  runtime.handleExtract(context.req.raw, context.env)
)
app.notFound((context) => context.text("Not found", 404))

export default app
