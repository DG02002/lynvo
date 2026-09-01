import { env } from "cloudflare:workers"
import { afterEach, describe, expect, it, vi } from "vitest"
import { insertGoogleUser } from "../../workers/d1/users"
import { refreshCustomPluginServerManifests } from "../../workers/plugin-server-manifest-refresh"

const USER_COUNT = 5
const SERVER_COUNT = 6
const EXPECTED_MAXIMUM_CONCURRENT_REFRESHES = 4
const FAILED_SERVER_ID = "manifest-refresh-server-0-a"

const manifest = {
  protocolVersion: "1.0",
  pluginServerId: "dev.example.plugin-server",
  displayName: "Example",
  auth: { type: "bearer" },
  usage: { endpoint: "/usage" },
  matchers: [{ hosts: ["source.example"] }],
  features: {},
  extensions: {},
}

describe("plugin server manifest refresh", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("bounds cross-account refreshes, serializes each account, and isolates failures", async () => {
    const users = await Promise.all(
      Array.from({ length: USER_COUNT }, (_, index) =>
        insertGoogleUser(env.DB, {
          googleSubject: `manifest-refresh-${crypto.randomUUID()}`,
          email: `manifest-refresh-${index}@example.com`,
          now: Date.now(),
        })
      )
    )
    const serverOwners = new Map<string, string>()
    const serverRecords = Array.from({ length: SERVER_COUNT }, (_, index) => {
      const userIndex = index <= 1 ? 0 : index - 1
      const serverId =
        index === 0
          ? FAILED_SERVER_ID
          : `manifest-refresh-server-${userIndex}-${index}`
      const hostname = `${serverId}.example.com`
      serverOwners.set(hostname, users[userIndex].id)
      return { serverId, hostname, userId: users[userIndex].id }
    })
    await env.DB.batch(
      serverRecords.map(({ serverId, hostname, userId }) =>
        env.DB.prepare(
          `INSERT INTO user_plugin_servers (
             id, user_id, base_url, normalized_base_url, api_key_ciphertext,
             api_key_nonce, api_key_algorithm, api_key_version,
             credential_status, manifest, enabled, priority,
             verification_status, created_at, updated_at
           ) VALUES (?1, ?2, ?3, ?3, 'ciphertext', 'nonce', 'AES-256-GCM', 1,
             'ready', '{}', 1, 0, 'verified', ?4, ?4)`
        ).bind(serverId, userId, `https://${hostname}`, Date.now())
      )
    )

    let activeRefreshes = 0
    let maximumActiveRefreshes = 0
    const activeRefreshesByUser = new Map<string, number>()
    const maximumActiveRefreshesByUser = new Map<string, number>()
    vi.spyOn(globalThis, "fetch").mockImplementation(async (request) => {
      const url = new URL(
        request instanceof Request ? request.url : String(request)
      )
      const userId = serverOwners.get(url.hostname)
      if (!userId) {
        throw new Error(`Unexpected refresh destination: ${url.hostname}`)
      }
      activeRefreshes += 1
      maximumActiveRefreshes = Math.max(maximumActiveRefreshes, activeRefreshes)
      const userActiveRefreshes = (activeRefreshesByUser.get(userId) ?? 0) + 1
      activeRefreshesByUser.set(userId, userActiveRefreshes)
      maximumActiveRefreshesByUser.set(
        userId,
        Math.max(
          maximumActiveRefreshesByUser.get(userId) ?? 0,
          userActiveRefreshes
        )
      )
      await new Promise((resolve) => setTimeout(resolve, 10))
      activeRefreshes -= 1
      activeRefreshesByUser.set(userId, userActiveRefreshes - 1)
      return url.hostname.startsWith(FAILED_SERVER_ID)
        ? Response.json({}, { status: 503 })
        : Response.json(manifest)
    })
    // SAFETY: The refresh path uses only the real D1 binding and the two test namespaces supplied below.
    const environment = {
      ...env,
      PLUGIN_SERVER_CREDENTIAL_VAULT: {
        getByName: () => ({
          fetch: async () => Response.json({ apiKey: "plugin-server-api-key" }),
        }),
      },
      USER_REALTIME_ROOM: {
        getByName: () => ({ fetch: async () => new Response(null) }),
      },
    } as Env

    const result = await refreshCustomPluginServerManifests(environment, env.DB)
    const storedServers = await env.DB.prepare(
      `SELECT id, verification_status, last_manifest_refresh_at
       FROM user_plugin_servers
       WHERE id LIKE 'manifest-refresh-server-%'
       ORDER BY id`
    ).all<{
      id: string
      verification_status: string
      last_manifest_refresh_at: number | null
    }>()

    expect(result).toEqual({ refreshed: SERVER_COUNT - 1, failed: 1 })
    expect(maximumActiveRefreshes).toBe(EXPECTED_MAXIMUM_CONCURRENT_REFRESHES)
    expect(maximumActiveRefreshesByUser.size).toBe(USER_COUNT)
    expect(
      Array.from(maximumActiveRefreshesByUser.values()).every(
        (refreshCount) => refreshCount === 1
      )
    ).toBe(true)
    expect(
      storedServers.results.find(({ id }) => id === FAILED_SERVER_ID)
    ).toMatchObject({
      verification_status: "down",
      last_manifest_refresh_at: null,
    })
    const successfulServers = storedServers.results.filter(
      ({ id }) => id !== FAILED_SERVER_ID
    )
    expect(successfulServers).toHaveLength(SERVER_COUNT - 1)
    expect(
      successfulServers.every(
        ({ verification_status, last_manifest_refresh_at }) =>
          verification_status === "verified" &&
          last_manifest_refresh_at !== null
      )
    ).toBe(true)
  })
})
