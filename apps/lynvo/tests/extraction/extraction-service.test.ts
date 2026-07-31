import { Effect, Layer } from "effect"
import { ExtractionService } from "~/lib/effect/services/extraction-service"
import { ConvexService } from "~/lib/effect/services/ConvexService"
import { CloudflareEnv } from "~/lib/effect/services/CloudflareEnv"
import { PluginCredentialVault } from "~/lib/effect/services/plugin-credential-vault"
import { LYNVO_PLUGIN_SERVER_ID } from "~/lib/constants"

const environment = {
  AUTH_GATEWAY_SECRET: "test-auth-gateway-secret",
} as Env

const extractionLayer = ExtractionService.layer.pipe(
  Layer.provide(
    Layer.mergeAll(
      Layer.succeed(CloudflareEnv, environment),
      Layer.succeed(
        ConvexService,
        ConvexService.of({
          action: () => Effect.die(new Error("Unexpected Convex action")),
          query: () => Effect.die(new Error("Unexpected Convex query")),
          mutation: () => Effect.die(new Error("Unexpected Convex mutation")),
        })
      ),
      Layer.succeed(
        PluginCredentialVault,
        PluginCredentialVault.of({
          encrypt: () => Effect.die(new Error("Unexpected credential write")),
          decrypt: () => Effect.die(new Error("Unexpected credential read")),
        })
      )
    )
  )
)

const runExtraction = <Result>(
  use: (service: ExtractionService["Service"]) => Effect.Effect<Result, unknown>
) =>
  Effect.runPromise(
    ExtractionService.use(use).pipe(Effect.provide(extractionLayer))
  )

describe("Extraction interface routing", () => {
  it("normalizes embedded HTTP Basic Auth before Extraction and metadata routing", async () => {
    const requestedUrls: string[] = []
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input) => {
        requestedUrls.push(String(input))
        return new Response(null, {
          status: 206,
          headers: { "Content-Type": "video/mp4" },
        })
      })
    const credentialUrl = "https://viewer:secret@cdn.example/video.mp4"

    await runExtraction((service) =>
      service.extract({ url: credentialUrl, requestId: "extract-request" })
    )
    await runExtraction((service) =>
      service.getMetadata({
        url: credentialUrl,
        requestId: "metadata-request",
        env: environment,
      })
    )

    expect(requestedUrls).toEqual([
      "https://cdn.example/video.mp4",
      "https://cdn.example/video.mp4",
    ])
    fetchMock.mockRestore()
  })

  it("uses inline Basic Auth without reading a stored Lynvo credential", async () => {
    const pluginServerRequests: Request[] = []
    const environmentWithLynvo = {
      ...environment,
      LYNVO_PLUGIN_SERVER_API_KEY: "lynvo-test-key",
      LYNVO_PLUGIN_SERVER: {
        fetch: async (request: Request) => {
          pluginServerRequests.push(request.clone())
          if (request.url.endsWith("/manifest")) {
            return Response.json({
              protocolVersion: "1.0",
              pluginServerId: LYNVO_PLUGIN_SERVER_ID,
              displayName: "Lynvo",
              auth: { type: "bearer" },
              usage: { endpoint: "/usage" },
              matchers: [{ hosts: ["protected.example"] }],
              features: { basicAuth: true },
              extensions: {
                lynvo: {
                  plugins: [
                    {
                      id: "protected",
                      displayName: "Protected",
                      status: "active",
                      version: "1.0.0",
                      hosts: ["protected.example"],
                      credential: {
                        kind: "http-basic",
                        scope: "domain",
                        required: false,
                      },
                    },
                  ],
                },
              },
            })
          }
          return Response.json({
            plugin: {
              pluginServerId: LYNVO_PLUGIN_SERVER_ID,
              displayName: "Lynvo",
            },
            nodes: [],
            extensions: {},
          })
        },
      },
    } as Env
    let queryCount = 0
    const layer = ExtractionService.layer.pipe(
      Layer.provide(
        Layer.mergeAll(
          Layer.succeed(CloudflareEnv, environmentWithLynvo),
          Layer.succeed(
            ConvexService,
            ConvexService.of({
              action: () => Effect.die(new Error("Unexpected Convex action")),
              query: () => {
                queryCount += 1
                if (queryCount === 1) return Effect.succeed([])
                if (queryCount === 2) return Effect.succeed(undefined)
                return Effect.die(new Error("Unexpected credential query"))
              },
              mutation: () => Effect.succeed(undefined),
            })
          ),
          Layer.succeed(
            PluginCredentialVault,
            PluginCredentialVault.of({
              encrypt: () =>
                Effect.die(new Error("Unexpected credential write")),
              decrypt: () =>
                Effect.die(new Error("Unexpected credential read")),
            })
          )
        )
      )
    )

    await Effect.runPromise(
      ExtractionService.use((service) =>
        service.extract({
          url: "https://viewer:secret@protected.example/video",
          requestId: "inline-basic-auth",
          pluginServerId: LYNVO_PLUGIN_SERVER_ID,
          pluginId: "protected",
          userId: "user-1",
          accessToken: "access-token",
        })
      ).pipe(Effect.provide(layer))
    )

    expect(queryCount).toBe(2)
    expect(
      await pluginServerRequests
        .find((request) => request.url.endsWith("/extract"))
        ?.json()
    ).toMatchObject({
      basicAuth: { username: "viewer", password: "secret" },
    })
  })
})
