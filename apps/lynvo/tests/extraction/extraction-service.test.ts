import { Effect, Layer } from "effect"
import { ExtractionService } from "~/lib/effect/services/extraction-service"
import { ConvexService } from "~/lib/effect/services/ConvexService"
import { CloudflareEnv } from "~/lib/effect/services/CloudflareEnv"
import { PluginCredentialVault } from "~/lib/effect/services/plugin-credential-vault"
import { LYNVO_PLUGIN_SERVER_ID } from "~/lib/constants"
import { ConvexError as AppConvexError } from "~/lib/effect/errors"

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
        requestedUrls.push(input instanceof Request ? input.url : String(input))
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
    queryCount = 0
    await Effect.runPromise(
      ExtractionService.use((service) =>
        service.extract({
          url: "https://viewer:secret@protected.example/video",
          requestId: "inline-basic-auth-node",
          pluginServerId: LYNVO_PLUGIN_SERVER_ID,
          pluginId: "protected",
          kind: "node",
          userId: "user-1",
          accessToken: "access-token",
        })
      ).pipe(Effect.provide(layer))
    )

    expect(queryCount).toBe(2)
    const extractionBodies = await Promise.all(
      pluginServerRequests
        .filter((request) => request.url.endsWith("/extract"))
        .map((request) => request.json())
    )
    expect(extractionBodies).toEqual([
      expect.objectContaining({
        input: expect.objectContaining({ kind: "source" }),
        basicAuth: { username: "viewer", password: "secret" },
      }),
      expect.objectContaining({
        input: expect.objectContaining({ kind: "node" }),
        basicAuth: { username: "viewer", password: "secret" },
      }),
    ])
  })

  it("propagates the metadata request ID through Lynvo route selection", async () => {
    const manifestRequestIds: Array<string | null> = []
    const environmentWithLynvo = {
      ...environment,
      LYNVO_PLUGIN_SERVER_API_KEY: "lynvo-test-key",
      LYNVO_PLUGIN_SERVER: {
        fetch: async (request: Request) => {
          manifestRequestIds.push(request.headers.get("x-request-id"))
          return Response.json({
            protocolVersion: "1.0",
            pluginServerId: LYNVO_PLUGIN_SERVER_ID,
            displayName: "Lynvo",
            auth: { type: "bearer" },
            usage: { endpoint: "/usage" },
            matchers: [{ hosts: ["media.example"] }],
            features: {},
            extensions: {
              lynvo: {
                plugins: [
                  {
                    id: "media",
                    displayName: "Media",
                    status: "active",
                    version: "1.0.0",
                    hosts: ["media.example"],
                    matchers: [{ hosts: ["media.example"] }],
                  },
                ],
              },
            },
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
                return Effect.succeed(queryCount === 1 ? [] : undefined)
              },
              mutation: () =>
                Effect.die(new Error("Unexpected Convex mutation")),
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
        service.getMetadata({
          url: "https://media.example/video",
          requestId: "metadata-route-request",
          userId: "user-1",
          accessToken: "access-token",
          env: environmentWithLynvo,
        })
      ).pipe(Effect.provide(layer))
    )

    expect(manifestRequestIds).toEqual(["metadata-route-request"])
  })

  it("keeps an explicitly selected Custom Plugin during discovery", async () => {
    const extractionPluginIds: Array<string | undefined> = []
    const manifest = JSON.stringify({
      protocolVersion: "1.0",
      pluginServerId: "dev.example.custom",
      displayName: "Custom",
      auth: { type: "bearer" },
      usage: { endpoint: "/usage" },
      matchers: [{ hosts: ["custom.example"] }],
      features: { discovery: true },
      extensions: {
        lynvo: {
          plugins: [
            {
              id: "chosen",
              displayName: "Chosen",
              status: "active",
              version: "1.0.0",
              hosts: ["custom.example"],
            },
            {
              id: "discovered",
              displayName: "Discovered",
              status: "active",
              version: "1.0.0",
              hosts: ["custom.example"],
            },
          ],
        },
      },
    })
    const storedPluginServer = {
      _id: "custom-server",
      _creationTime: 1,
      userId: "user-1",
      baseUrl: "https://plugin-server.example",
      manifest,
      enabled: true,
      priority: 1,
      verificationStatus: "verified",
      createdAt: 1,
      updatedAt: 1,
      apiKeyCiphertext: "ciphertext",
      apiKeyNonce: "nonce",
      apiKeyAlgorithm: "AES-256-GCM" as const,
      apiKeyVersion: 1,
    }
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const request = new Request(input, init)
        if (request.url.endsWith("/discover")) {
          return Response.json({
            matched: true,
            pluginId: "discovered",
            confidence: "verified",
          })
        }
        const body = await request.json<{
          pluginId?: string
        }>()
        extractionPluginIds.push(body.pluginId)
        return Response.json({
          plugin: {
            pluginServerId: "dev.example.custom",
            displayName: "Custom",
          },
          nodes: [],
          extensions: {},
        })
      })
    const environmentWithCustom = {
      ...environment,
      PLUGIN_SERVER_CREDENTIAL_VAULT: {
        getByName: () => ({
          fetch: async () => Response.json({ apiKey: "custom-api-key" }),
        }),
      },
    } as Env
    const layer = ExtractionService.layer.pipe(
      Layer.provide(
        Layer.mergeAll(
          Layer.succeed(CloudflareEnv, environmentWithCustom),
          Layer.succeed(
            ConvexService,
            ConvexService.of({
              action: () => Effect.die(new Error("Unexpected Convex action")),
              query: () => Effect.succeed([storedPluginServer]),
              mutation: () =>
                Effect.die(new Error("Unexpected Convex mutation")),
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
          url: "https://custom.example/video",
          requestId: "explicit-custom-plugin",
          pluginServerId: "custom-server",
          pluginId: "chosen",
          userId: "user-1",
          accessToken: "access-token",
        })
      ).pipe(Effect.provide(layer))
    )

    await expect(
      Effect.runPromise(
        ExtractionService.use((service) =>
          service.extract({
            url: "https://custom.example/video",
            requestId: "missing-custom-plugin",
            pluginServerId: "custom-server",
            pluginId: "missing",
            userId: "user-1",
            accessToken: "access-token",
          })
        ).pipe(Effect.provide(layer))
      )
    ).rejects.toMatchObject({
      _tag: "ValidationError",
      message: "The saved Plugin is unavailable.",
    })

    expect(extractionPluginIds).toEqual(["chosen"])
    fetchMock.mockRestore()
  })

  it("does not use direct media when Lynvo route loading fails", async () => {
    const directMediaFetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () =>
        Response.json({ unexpected: "direct media fallback" })
      )
    const environmentWithUnavailableLynvo = {
      ...environment,
      LYNVO_PLUGIN_SERVER_API_KEY: "lynvo-test-key",
      LYNVO_PLUGIN_SERVER: {
        fetch: async () =>
          Response.json(
            {
              ok: false,
              error: { code: "TEMPORARY_FAILURE", message: "Unavailable" },
              extensions: {},
            },
            { status: 503 }
          ),
      },
    } as Env
    const layer = ExtractionService.layer.pipe(
      Layer.provide(
        Layer.mergeAll(
          Layer.succeed(CloudflareEnv, environmentWithUnavailableLynvo),
          Layer.succeed(
            ConvexService,
            ConvexService.of({
              action: () => Effect.die(new Error("Unexpected Convex action")),
              query: () => Effect.succeed([]),
              mutation: () =>
                Effect.die(new Error("Unexpected Convex mutation")),
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

    await expect(
      Effect.runPromise(
        ExtractionService.use((service) =>
          service.extract({
            url: "https://source.example/video",
            requestId: "lynvo-route-failure",
            userId: "user-1",
            accessToken: "access-token",
          })
        ).pipe(Effect.provide(layer))
      )
    ).rejects.toMatchObject({
      _tag: "ExtractionError",
      message: "TEMPORARY_FAILURE",
    })
    expect(directMediaFetch).not.toHaveBeenCalled()
    directMediaFetch.mockRestore()
  })

  it("stops a metered Lynvo route when quota consumption fails", async () => {
    let pluginExtractionCount = 0
    const directMediaFetch = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () =>
        Response.json({ unexpected: "direct media fallback" })
      )
    const environmentWithLynvo = {
      ...environment,
      LYNVO_PLUGIN_SERVER_API_KEY: "lynvo-test-key",
      LYNVO_PLUGIN_SERVER: {
        fetch: async (request: Request) => {
          if (!request.url.endsWith("/manifest")) {
            pluginExtractionCount += 1
          }
          return Response.json({
            protocolVersion: "1.0",
            pluginServerId: LYNVO_PLUGIN_SERVER_ID,
            displayName: "Lynvo",
            auth: { type: "bearer" },
            usage: { endpoint: "/usage" },
            matchers: [{ hosts: ["metered.example"] }],
            features: {},
            extensions: {
              lynvo: {
                plugins: [
                  {
                    id: "direct",
                    displayName: "Metered",
                    status: "active",
                    version: "1.0.0",
                    hosts: ["metered.example"],
                    matchers: [{ hosts: ["metered.example"] }],
                  },
                ],
              },
            },
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
                return Effect.succeed(queryCount === 1 ? [] : undefined)
              },
              mutation: () =>
                Effect.fail(
                  new AppConvexError({ message: "Daily quota reached" })
                ),
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

    await expect(
      Effect.runPromise(
        ExtractionService.use((service) =>
          service.extract({
            url: "https://metered.example/video",
            requestId: "metered-route",
            userId: "user-1",
            accessToken: "access-token",
          })
        ).pipe(Effect.provide(layer))
      )
    ).rejects.toMatchObject({
      _tag: "ExtractionError",
      message: "Daily quota reached",
    })
    expect(pluginExtractionCount).toBe(0)
    expect(directMediaFetch).not.toHaveBeenCalled()
    directMediaFetch.mockRestore()
  })

  it("does not invoke a Custom Plugin without its required credential", async () => {
    let pluginExtractionCount = 0
    const manifest = JSON.stringify({
      protocolVersion: "1.0",
      pluginServerId: "dev.example.protected",
      displayName: "Protected Custom",
      auth: { type: "bearer" },
      usage: { endpoint: "/usage" },
      matchers: [{ hosts: ["protected-custom.example"] }],
      features: {},
      extensions: {
        lynvo: {
          plugins: [
            {
              id: "protected-custom",
              displayName: "Protected Custom",
              status: "active",
              version: "1.0.0",
              hosts: ["protected-custom.example"],
              credential: {
                kind: "domain-password",
                scope: "domain",
                required: true,
              },
            },
          ],
        },
      },
    })
    const storedPluginServer = {
      _id: "protected-custom-server",
      _creationTime: 1,
      userId: "user-1",
      baseUrl: "https://protected-plugin-server.example",
      manifest,
      enabled: true,
      priority: 1,
      verificationStatus: "verified",
      createdAt: 1,
      updatedAt: 1,
      apiKeyCiphertext: "ciphertext",
      apiKeyNonce: "nonce",
      apiKeyAlgorithm: "AES-256-GCM" as const,
      apiKeyVersion: 1,
    }
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () => {
        pluginExtractionCount += 1
        return Response.json({
          plugin: {
            pluginServerId: "dev.example.protected",
            displayName: "Protected Custom",
          },
          nodes: [],
          extensions: {},
        })
      })
    const environmentWithCustom = {
      ...environment,
      PLUGIN_SERVER_CREDENTIAL_VAULT: {
        getByName: () => ({
          fetch: async () => Response.json({ apiKey: "custom-api-key" }),
        }),
      },
    } as Env
    let queryCount = 0
    const layer = ExtractionService.layer.pipe(
      Layer.provide(
        Layer.mergeAll(
          Layer.succeed(CloudflareEnv, environmentWithCustom),
          Layer.succeed(
            ConvexService,
            ConvexService.of({
              action: () => Effect.die(new Error("Unexpected Convex action")),
              query: () => {
                queryCount += 1
                return Effect.succeed(
                  queryCount === 1 ? [storedPluginServer] : undefined
                )
              },
              mutation: () =>
                Effect.die(new Error("Unexpected Convex mutation")),
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

    await expect(
      Effect.runPromise(
        ExtractionService.use((service) =>
          service.extract({
            url: "https://protected-custom.example/video",
            requestId: "required-custom-credential",
            pluginServerId: "protected-custom-server",
            pluginId: "protected-custom",
            userId: "user-1",
            accessToken: "access-token",
          })
        ).pipe(Effect.provide(layer))
      )
    ).rejects.toMatchObject({
      _tag: "ExtractionError",
      message: "Required Plugin credential is unavailable.",
    })
    expect(pluginExtractionCount).toBe(0)
    fetchMock.mockRestore()
  })

  it("does not hide Custom discovery failure with generic extraction", async () => {
    let pluginExtractionCount = 0
    const manifest = JSON.stringify({
      protocolVersion: "1.0",
      pluginServerId: "dev.example.discovery",
      displayName: "Discovery Custom",
      auth: { type: "bearer" },
      usage: { endpoint: "/usage" },
      matchers: [{ hosts: ["discovery-failure.example"] }],
      features: { discovery: true },
      extensions: {
        lynvo: {
          plugins: [
            {
              id: "other-host",
              displayName: "Other Host",
              status: "active",
              version: "1.0.0",
              hosts: ["other.example"],
              matchers: [{ hosts: ["other.example"] }],
            },
          ],
        },
      },
    })
    const storedPluginServer = {
      _id: "discovery-custom-server",
      _creationTime: 1,
      userId: "user-1",
      baseUrl: "https://discovery-plugin-server.example",
      manifest,
      enabled: true,
      priority: 1,
      verificationStatus: "verified",
      createdAt: 1,
      updatedAt: 1,
      apiKeyCiphertext: "ciphertext",
      apiKeyNonce: "nonce",
      apiKeyAlgorithm: "AES-256-GCM" as const,
      apiKeyVersion: 1,
    }
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const request = new Request(input, init)
        if (request.url.endsWith("/discover")) {
          return Response.json(
            {
              ok: false,
              error: { code: "TEMPORARY_FAILURE", message: "Unavailable" },
              extensions: {},
            },
            { status: 503 }
          )
        }
        pluginExtractionCount += 1
        return Response.json({
          plugin: {
            pluginServerId: "dev.example.discovery",
            displayName: "Discovery Custom",
          },
          nodes: [],
          extensions: {},
        })
      })
    const environmentWithCustom = {
      ...environment,
      PLUGIN_SERVER_CREDENTIAL_VAULT: {
        getByName: () => ({
          fetch: async () => Response.json({ apiKey: "custom-api-key" }),
        }),
      },
    } as Env
    const layer = ExtractionService.layer.pipe(
      Layer.provide(
        Layer.mergeAll(
          Layer.succeed(CloudflareEnv, environmentWithCustom),
          Layer.succeed(
            ConvexService,
            ConvexService.of({
              action: () => Effect.die(new Error("Unexpected Convex action")),
              query: () => Effect.succeed([storedPluginServer]),
              mutation: () =>
                Effect.die(new Error("Unexpected Convex mutation")),
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

    await expect(
      Effect.runPromise(
        ExtractionService.use((service) =>
          service.extract({
            url: "https://discovery-failure.example/video",
            requestId: "custom-discovery-failure",
            userId: "user-1",
            accessToken: "access-token",
          })
        ).pipe(Effect.provide(layer))
      )
    ).rejects.toMatchObject({
      _tag: "ExtractionError",
      message: "TEMPORARY_FAILURE",
    })
    expect(pluginExtractionCount).toBe(0)
    fetchMock.mockRestore()
  })
})
