import { Effect, Layer } from "effect"
import { ExtractionService } from "~/lib/effect/services/extraction-service"
import { CloudflareEnv } from "~/lib/effect/services/cloudflare-env"
import { PluginCredentialVault } from "~/lib/effect/services/plugin-credential-vault"
import { LYNVO_PLUGIN_SERVER_ID } from "~/lib/constants"
import { createFakeD1Database } from "../support/fake-d1"

// SAFETY: The shared test environment is intentionally empty; each test supplies the bindings it exercises.
const environment = {} as Env

const noCredentialVault = Layer.succeed(
  PluginCredentialVault,
  PluginCredentialVault.of({
    encrypt: () => Effect.die(new Error("Unexpected credential write")),
    decrypt: () => Effect.die(new Error("Unexpected credential read")),
  })
)

const buildLayer = (testEnvironment: Env) =>
  ExtractionService.layer.pipe(
    Layer.provide(
      Layer.mergeAll(
        Layer.succeed(CloudflareEnv, testEnvironment),
        noCredentialVault
      )
    )
  )

const lynvoManifestResponse = (plugins: unknown[], hosts: string[]) =>
  Response.json({
    protocolVersion: "1.0",
    pluginServerId: "dev.lynvo.plugin-server",
    displayName: "Lynvo Plugin Server",
    auth: { type: "bearer" },
    usage: { endpoint: "/usage" },
    matchers: [{ hosts }],
    features: {},
    extensions: { lynvo: { plugins } },
  })

const emptyExtractionResponse = (displayName: string) =>
  Response.json({
    plugin: {
      pluginServerId: "dev.example.custom",
      displayName,
    },
    nodes: [],
    extensions: {},
  })

const storedCustomServerRow = (
  id: string,
  baseUrl: string,
  manifest: string
) => ({
  id,
  user_id: "user-1",
  base_url: baseUrl,
  normalized_base_url: baseUrl,
  api_key_ciphertext: "ciphertext",
  api_key_nonce: "nonce",
  api_key_algorithm: "AES-256-GCM",
  api_key_version: 1,
  credential_status: "ready",
  credential_generation: 1,
  credential_attempt_id: null,
  pending_expires_at: null,
  failure_reason: null,
  manifest,
  enabled: 1,
  priority: 1,
  verification_status: "verified",
  last_verified_at: 1,
  last_manifest_refresh_at: 1,
  created_at: 1,
  updated_at: 1,
})

describe("Extraction interface routing", () => {
  it("routes an assigned Plugin before Direct Media probing", async () => {
    const coreFetch = vi.spyOn(globalThis, "fetch")
    const pluginServerRequests: Request[] = []
    // SAFETY: This fixture supplies the Cloudflare bindings used by the routing test.
    const testEnvironment = {
      ...environment,
      MANAGED_PLUGIN_SERVER_API_KEY: "lynvo-test-key",
      LYNVO_PLUGIN_SERVER: {
        fetch: async (request: Request) => {
          pluginServerRequests.push(request.clone())
          if (request.url.endsWith("/manifest")) {
            return lynvoManifestResponse(
              [
                {
                  id: "example-drive-index",
                  displayName: "Example",
                  status: "active",
                  version: "1.0.0",
                  hosts: ["drive.example"],
                  matchers: [{ hosts: ["drive.example"] }],
                },
                {
                  id: "direct-media",
                  displayName: "Direct Media",
                  status: "active",
                  version: "1.0.0",
                  matchStrategy: "probe",
                  hosts: [],
                },
              ],
              ["drive.example"]
            )
          }
          return Response.json({
            plugin: {
              pluginServerId: "dev.lynvo.plugin-server",
              displayName: "Lynvo Plugin Server",
              pluginId: "example-drive-index",
              pluginName: "Example",
            },
            nodes: [
              {
                kind: "playable",
                label: "plugin-result.mkv",
                url: "https://drive.example/plugin-result.mkv",
              },
            ],
            extensions: {},
          })
        },
      },
      DB: createFakeD1Database(() => undefined),
    } as Env
    const result = await Effect.runPromise(
      ExtractionService.use((service) =>
        service.extract({
          url: "https://drive.example/download.aspx?file=signed",
          requestId: "assigned-plugin-domain",
          pluginServerId: LYNVO_PLUGIN_SERVER_ID,
          pluginId: "example-drive-index",
          userId: "user-1",
        })
      ).pipe(Effect.provide(buildLayer(testEnvironment)))
    )

    expect(result.links).toEqual([
      expect.objectContaining({ label: "plugin-result.mkv" }),
    ])
    expect(coreFetch).not.toHaveBeenCalled()
    expect(
      pluginServerRequests.some((request) => request.url.endsWith("/extract"))
    ).toBe(true)
  })

  it("reads unauthenticated Direct Media metadata from the Plugin Server manifest", async () => {
    const coreFetch = vi.spyOn(globalThis, "fetch")
    // SAFETY: This fixture supplies the Cloudflare bindings used by the metadata test.
    const environmentWithLynvo = {
      ...environment,
      MANAGED_PLUGIN_SERVER_API_KEY: "lynvo-test-key",
      LYNVO_PLUGIN_SERVER: {
        fetch: async () =>
          lynvoManifestResponse(
            [
              {
                id: "direct-media",
                displayName: "Direct Media",
                status: "active",
                version: "1.0.0",
                matchStrategy: "probe",
                hosts: [],
              },
            ],
            ["media.example"]
          ),
      },
    } as Env

    const result = await Effect.runPromise(
      ExtractionService.use((service) =>
        service.getMetadata({
          url: "https://media.example/video.mp4",
          requestId: "direct-media-metadata",
          env: environmentWithLynvo,
        })
      ).pipe(Effect.provide(buildLayer(environmentWithLynvo)))
    )

    expect(result).toMatchObject({
      pluginId: "direct-media",
      pluginName: "Lynvo Plugin Server",
      sourceName: "Direct Media",
    })
    expect(coreFetch).not.toHaveBeenCalled()
  })

  it("uses inline Basic Auth without reading a stored Lynvo credential", async () => {
    const pluginServerRequests: Request[] = []
    const credentialQueries: string[] = []
    // SAFETY: This fixture supplies the Cloudflare bindings used by the credential test.
    const testEnvironment = {
      ...environment,
      MANAGED_PLUGIN_SERVER_API_KEY: "lynvo-test-key",
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
      DB: createFakeD1Database((sql) => {
        if (sql.includes("user_plugin_credentials")) {
          credentialQueries.push(sql)
        }
        return undefined
      }),
    } as Env
    await Effect.runPromise(
      ExtractionService.use((service) =>
        service.extract({
          url: "https://viewer:secret@protected.example/video",
          requestId: "inline-basic-auth",
          pluginServerId: LYNVO_PLUGIN_SERVER_ID,
          pluginId: "protected",
          userId: "user-1",
        })
      ).pipe(Effect.provide(buildLayer(testEnvironment)))
    )

    expect(credentialQueries).toEqual([])
    await Effect.runPromise(
      ExtractionService.use((service) =>
        service.extract({
          url: "https://viewer:secret@protected.example/video",
          requestId: "inline-basic-auth-node",
          pluginServerId: LYNVO_PLUGIN_SERVER_ID,
          pluginId: "protected",
          kind: "node",
          userId: "user-1",
        })
      ).pipe(Effect.provide(buildLayer(testEnvironment)))
    )

    expect(credentialQueries).toEqual([])
    await Effect.runPromise(
      ExtractionService.use((service) =>
        service.extract({
          url: "https://protected.example/video",
          requestId: "sanitized-inline-basic-auth",
          pluginServerId: LYNVO_PLUGIN_SERVER_ID,
          pluginId: "protected",
          userId: "user-1",
          inlineBasicAuth: { username: "viewer", password: "secret" },
        })
      ).pipe(Effect.provide(buildLayer(testEnvironment)))
    )

    expect(credentialQueries).toEqual([])
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
      expect.objectContaining({
        input: expect.objectContaining({ kind: "source" }),
        basicAuth: { username: "viewer", password: "secret" },
      }),
    ])
  })

  it("propagates the metadata request ID through Lynvo route selection", async () => {
    const manifestRequestIds: Array<string | null> = []
    // SAFETY: This fixture supplies the Cloudflare bindings used by the request ID test.
    const testEnvironment = {
      ...environment,
      MANAGED_PLUGIN_SERVER_API_KEY: "lynvo-test-key",
      LYNVO_PLUGIN_SERVER: {
        fetch: async (request: Request) => {
          manifestRequestIds.push(request.headers.get("x-request-id"))
          return lynvoManifestResponse(
            [
              {
                id: "media",
                displayName: "Media",
                status: "active",
                version: "1.0.0",
                hosts: ["media.example"],
                matchers: [{ hosts: ["media.example"] }],
              },
            ],
            ["media.example"]
          )
        },
      },
      DB: createFakeD1Database(() => undefined),
    } as Env

    await Effect.runPromise(
      ExtractionService.use((service) =>
        service.getMetadata({
          url: "https://media.example/video",
          requestId: "metadata-route-request",
          userId: "user-1",
          env: testEnvironment,
        })
      ).pipe(Effect.provide(buildLayer(testEnvironment)))
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
    const storedPluginServer = storedCustomServerRow(
      "custom-server",
      "https://plugin-server.example",
      manifest
    )
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
        return emptyExtractionResponse("Custom")
      })
    // SAFETY: This fixture supplies the Cloudflare bindings used by the custom routing test.
    const testEnvironment = {
      ...environment,
      PLUGIN_SERVER_CREDENTIAL_VAULT: {
        getByName: () => ({
          fetch: async () => Response.json({ apiKey: "custom-api-key" }),
        }),
      },
      DB: createFakeD1Database((sql) =>
        sql.includes("FROM user_plugin_servers")
          ? { rows: [storedPluginServer] }
          : undefined
      ),
    } as Env

    await Effect.runPromise(
      ExtractionService.use((service) =>
        service.extract({
          url: "https://custom.example/video",
          requestId: "explicit-custom-plugin",
          pluginServerId: "custom-server",
          pluginId: "chosen",
          userId: "user-1",
        })
      ).pipe(Effect.provide(buildLayer(testEnvironment)))
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
          })
        ).pipe(Effect.provide(buildLayer(testEnvironment)))
      )
    ).rejects.toMatchObject({
      _tag: "ValidationError",
      message: "The saved Plugin is unavailable.",
    })

    expect(extractionPluginIds).toEqual(["chosen"])
    fetchMock.mockRestore()
  })

  it("preserves a Lynvo Plugin Server route failure", async () => {
    // SAFETY: This fixture supplies the Cloudflare bindings used by the failure test.
    const testEnvironment = {
      ...environment,
      MANAGED_PLUGIN_SERVER_API_KEY: "lynvo-test-key",
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
      DB: createFakeD1Database(() => undefined),
    } as Env

    await expect(
      Effect.runPromise(
        ExtractionService.use((service) =>
          service.extract({
            url: "https://source.example/video",
            requestId: "lynvo-route-failure",
            userId: "user-1",
          })
        ).pipe(Effect.provide(buildLayer(testEnvironment)))
      )
    ).rejects.toMatchObject({
      _tag: "ExtractionError",
      message: "TEMPORARY_FAILURE",
    })
  })

  it("stops a metered Lynvo route when quota reservation fails", async () => {
    let pluginExtractionCount = 0
    // SAFETY: This fixture supplies the Cloudflare bindings used by the metering test.
    const testEnvironment = {
      ...environment,
      MANAGED_PLUGIN_SERVER_API_KEY: "lynvo-test-key",
      LYNVO_PLUGIN_SERVER: {
        fetch: async (request: Request) => {
          if (!request.url.endsWith("/manifest")) {
            pluginExtractionCount += 1
          }
          return lynvoManifestResponse(
            [
              {
                id: "direct-media",
                displayName: "Metered",
                status: "active",
                version: "1.0.0",
                hosts: ["metered.example"],
                matchers: [{ hosts: ["metered.example"] }],
              },
            ],
            ["metered.example"]
          )
        },
      },
      DB: createFakeD1Database((sql) =>
        sql.includes("managed_extraction_operations") ||
        sql.includes("usage_counters") ||
        sql.includes("usage_epochs")
          ? { error: new Error("Daily quota reached") }
          : undefined
      ),
    } as Env

    await expect(
      Effect.runPromise(
        ExtractionService.use((service) =>
          service.extract({
            url: "https://metered.example/video",
            requestId: "metered-route",
            userId: "user-1",
          })
        ).pipe(Effect.provide(buildLayer(testEnvironment)))
      )
    ).rejects.toMatchObject({
      _tag: "ExtractionError",
      message: "Daily quota reached",
    })
    expect(pluginExtractionCount).toBe(0)
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
    const storedPluginServer = storedCustomServerRow(
      "protected-custom-server",
      "https://protected-plugin-server.example",
      manifest
    )
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const request = new Request(input, init)
        if (request.url.endsWith("/extract")) {
          pluginExtractionCount += 1
        }
        return emptyExtractionResponse("Protected Custom")
      })
    // SAFETY: This fixture supplies the Cloudflare bindings used by the credential requirement test.
    const testEnvironment = {
      ...environment,
      PLUGIN_SERVER_CREDENTIAL_VAULT: {
        getByName: () => ({
          fetch: async () => Response.json({ apiKey: "custom-api-key" }),
        }),
      },
      DB: createFakeD1Database((sql) =>
        sql.includes("FROM user_plugin_servers")
          ? { rows: [storedPluginServer] }
          : undefined
      ),
    } as Env

    await expect(
      Effect.runPromise(
        ExtractionService.use((service) =>
          service.extract({
            url: "https://protected-custom.example/video",
            requestId: "required-custom-credential",
            pluginServerId: "protected-custom-server",
            pluginId: "protected-custom",
            userId: "user-1",
          })
        ).pipe(Effect.provide(buildLayer(testEnvironment)))
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
    const storedPluginServer = storedCustomServerRow(
      "discovery-custom-server",
      "https://discovery-plugin-server.example",
      manifest
    )
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
        if (request.url.endsWith("/extract")) {
          pluginExtractionCount += 1
        }
        return emptyExtractionResponse("Discovery Custom")
      })
    // SAFETY: This fixture supplies the Cloudflare bindings used by the discovery failure test.
    const testEnvironment = {
      ...environment,
      PLUGIN_SERVER_CREDENTIAL_VAULT: {
        getByName: () => ({
          fetch: async () => Response.json({ apiKey: "custom-api-key" }),
        }),
      },
      DB: createFakeD1Database((sql) =>
        sql.includes("FROM user_plugin_servers")
          ? { rows: [storedPluginServer] }
          : undefined
      ),
    } as Env

    await expect(
      Effect.runPromise(
        ExtractionService.use((service) =>
          service.extract({
            url: "https://discovery-failure.example/video",
            requestId: "custom-discovery-failure",
            userId: "user-1",
          })
        ).pipe(Effect.provide(buildLayer(testEnvironment)))
      )
    ).rejects.toMatchObject({
      _tag: "ExtractionError",
      message: "TEMPORARY_FAILURE",
    })
    expect(pluginExtractionCount).toBe(0)
    fetchMock.mockRestore()
  })

  it("selects a matched Example Plugin before Direct Media probing", async () => {
    const pluginServerRequests: Request[] = []
    // SAFETY: This fixture supplies the Cloudflare bindings used by the Example routing test.
    const testEnvironment = {
      ...environment,
      MANAGED_PLUGIN_SERVER_API_KEY: "lynvo-test-key",
      LYNVO_PLUGIN_SERVER: {
        fetch: async (request: Request) => {
          pluginServerRequests.push(request.clone())
          if (request.url.endsWith("/manifest")) {
            return Response.json({
              protocolVersion: "1.0",
              pluginServerId: LYNVO_PLUGIN_SERVER_ID,
              displayName: "Lynvo Plugin Server",
              auth: { type: "bearer" },
              usage: { endpoint: "/usage" },
              matchers: [
                {
                  hosts: ["drive.example.invalid"],
                  hostPatterns: ["*"],
                  pathPatterns: ["/0:/**"],
                },
              ],
              features: { discovery: true },
              extensions: {
                lynvo: {
                  plugins: [
                    {
                      id: "example-drive-index",
                      displayName: "Example’s Drive Index",
                      status: "active",
                      version: "1.0.0",
                      hosts: ["drive.example.invalid"],
                      matchers: [
                        {
                          hosts: ["drive.example.invalid"],
                          hostPatterns: ["*"],
                          pathPatterns: ["/0:/**"],
                        },
                      ],
                      credential: {
                        kind: "http-basic",
                        scope: "domain",
                        required: false,
                      },
                    },
                    {
                      id: "direct-media",
                      displayName: "Direct Media",
                      status: "active",
                      version: "1.0.0",
                      matchStrategy: "probe",
                      hosts: [],
                    },
                  ],
                },
              },
            })
          }
          if (request.url.endsWith("/discover")) {
            return Response.json({
              matched: true,
              pluginId: "example-drive-index",
              confidence: "pattern",
            })
          }
          return Response.json({
            plugin: {
              pluginServerId: LYNVO_PLUGIN_SERVER_ID,
              displayName: "Lynvo Plugin Server",
              pluginId: "example-drive-index",
              pluginName: "Example’s Drive Index",
            },
            nodes: [
              {
                kind: "playable",
                id: "item-1",
                label: "Episode 1.mkv",
                url: "https://gd.example.host/0:/Show/Episode 1.mkv",
              },
            ],
            extensions: {},
          })
        },
      },
      DB: createFakeD1Database(() => undefined),
    } as Env

    const result = await Effect.runPromise(
      ExtractionService.use((service) =>
        service.extract({
          url: "https://gd.example.host/0:/Show/",
          requestId: "example-drive-auto-discover",
          userId: "user-1",
        })
      ).pipe(Effect.provide(buildLayer(testEnvironment)))
    )

    expect(result.links).toEqual([
      expect.objectContaining({ label: "Episode 1.mkv" }),
    ])
    expect(result.meta).toMatchObject({
      pluginId: "example-drive-index",
      pluginServerId: LYNVO_PLUGIN_SERVER_ID,
    })
    expect(
      pluginServerRequests.some((request) => request.url.endsWith("/discover"))
    ).toBe(false)
    expect(
      pluginServerRequests.some((request) => request.url.endsWith("/extract"))
    ).toBe(true)
  })

  it("selects a matched Cloud Plugin before Direct Media probing", async () => {
    const pluginServerRequests: Request[] = []
    // SAFETY: This fixture supplies the Cloudflare bindings used by the Cloud routing test.
    const testEnvironment = {
      ...environment,
      MANAGED_PLUGIN_SERVER_API_KEY: "lynvo-test-key",
      LYNVO_PLUGIN_SERVER: {
        fetch: async (request: Request) => {
          pluginServerRequests.push(request.clone())
          if (request.url.endsWith("/manifest")) {
            return Response.json({
              protocolVersion: "1.0",
              pluginServerId: LYNVO_PLUGIN_SERVER_ID,
              displayName: "Lynvo Plugin Server",
              auth: { type: "bearer" },
              usage: { endpoint: "/usage" },
              matchers: [
                {
                  hosts: ["cloud.example.invalid"],
                  hostPatterns: ["*"],
                  pathPatterns: ["/**"],
                },
              ],
              features: { discovery: true },
              extensions: {
                lynvo: {
                  plugins: [
                    {
                      id: "example-cloud-index",
                      displayName: "Sample's Cloud Drive Index",
                      status: "active",
                      version: "1.0.0",
                      hosts: ["cloud.example.invalid"],
                      matchers: [
                        {
                          hosts: ["cloud.example.invalid"],
                          hostPatterns: ["*"],
                          pathPatterns: ["/**"],
                        },
                      ],
                      credential: {
                        kind: "domain-password",
                        scope: "domain",
                        required: false,
                      },
                    },
                    {
                      id: "direct-media",
                      displayName: "Direct Media",
                      status: "active",
                      version: "1.0.0",
                      matchStrategy: "probe",
                      hosts: [],
                    },
                  ],
                },
              },
            })
          }
          if (request.url.endsWith("/discover")) {
            return Response.json({
              matched: true,
              pluginId: "example-cloud-index",
              confidence: "verified",
            })
          }
          return Response.json({
            plugin: {
              pluginServerId: LYNVO_PLUGIN_SERVER_ID,
              displayName: "Lynvo Plugin Server",
              pluginId: "example-cloud-index",
              pluginName: "Sample's Cloud Drive Index",
            },
            nodes: [
              {
                kind: "playable",
                id: "od-1",
                label: "Movie.mp4",
                url: "https://cloud.example.com/Movie.mp4",
              },
            ],
            extensions: {},
          })
        },
      },
      DB: createFakeD1Database(() => undefined),
    } as Env

    const result = await Effect.runPromise(
      ExtractionService.use((service) =>
        service.extract({
          url: "https://cloud.example.com/Movies/",
          requestId: "example-cloud-auto-discover",
          userId: "user-1",
        })
      ).pipe(Effect.provide(buildLayer(testEnvironment)))
    )

    expect(result.links).toEqual([
      expect.objectContaining({ label: "Movie.mp4" }),
    ])
    expect(result.meta).toMatchObject({
      pluginId: "example-cloud-index",
      pluginServerId: LYNVO_PLUGIN_SERVER_ID,
    })
    expect(
      pluginServerRequests.some((request) => request.url.endsWith("/discover"))
    ).toBe(false)
    expect(
      pluginServerRequests.some((request) => request.url.endsWith("/extract"))
    ).toBe(true)
  })
})
