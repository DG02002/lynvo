import { Hono } from "hono"
import {
  createPluginServerRuntime,
  ProtocolError,
  validPluginServerManifestFixture,
  validUsageResponseFixture,
  validateBearerCredential,
  type PluginServerManifest,
} from "@dg02002/lynvo-plugin-server-protocol"
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
          matchStrategy: "static",
          hosts: ["media.example.com"],
        },
      ],
    },
  },
} satisfies PluginServerManifest

const runtime = createPluginServerRuntime<Env>({
  manifest,
  auth: {
    validate: ({ request, env }) =>
      validateBearerCredential(request, env.LYNVO_PLUGIN_SERVER_API_KEY),
  },
  usage: () => validUsageResponseFixture,
  extract: ({ target }) => {
    if (target.kind !== "url") {
      throw new ProtocolError(
        "UNSUPPORTED_TARGET",
        "This example only accepts URL targets."
      )
    }
    return extractExampleSource(target.url, manifest.pluginServerId)
  },
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
