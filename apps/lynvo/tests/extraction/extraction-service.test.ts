import { Effect, Layer } from "effect"
import { ExtractionService } from "~/lib/effect/services/extraction-service"
import { ConvexService } from "~/lib/effect/services/ConvexService"
import { CloudflareEnv } from "~/lib/effect/services/CloudflareEnv"
import { PluginCredentialVault } from "~/lib/effect/services/plugin-credential-vault"

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
})
