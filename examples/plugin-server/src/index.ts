import {
  createPluginServerRuntime,
  validPluginServerManifestFixture,
  validUsageResponseFixture,
} from "@dg02002/lynvo-plugin-server-protocol"

export const manifest = validPluginServerManifestFixture

type ExampleEnvironment = Record<string, never>

const runtime = createPluginServerRuntime<ExampleEnvironment>({
  manifest,
  auth: {
    validate: ({ request }) =>
      request.headers.get("authorization") === "Bearer example-secret",
  },
  usage: () => validUsageResponseFixture,
  extract: ({ targetUrl }) => ({
    plugin: {
      pluginServerId: manifest.pluginServerId,
      displayName: manifest.displayName,
      pluginId: "example-media",
      pluginName: "Example Media",
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
