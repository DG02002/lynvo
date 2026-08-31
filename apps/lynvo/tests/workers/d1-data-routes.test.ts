import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"
import app from "../../workers/app"
import {
  DATA_VERSION_RESPONSE_HEADER,
  LINK_LIMIT_BYTES,
} from "../../workers/constants"
import { getDataVersion } from "../../workers/d1/data-version"
import { createSession } from "../../workers/d1/sessions"
import { insertGoogleUser } from "../../workers/d1/users"

const NOW = 1_750_000_000_000

const createUser = async () =>
  insertGoogleUser(env.DB, {
    googleSubject: `subject-${crypto.randomUUID()}`,
    email: `data-routes-${crypto.randomUUID()}@example.com`,
    now: NOW,
  })

const createSessionFor = async (userId: string) =>
  createSession(env.DB, { userId, now: Date.now() })

const dataApiRequest = (
  path: string,
  session: { readonly id: string },
  init: RequestInit = {}
): Request => {
  const headers = new Headers(init.headers)
  headers.set("Cookie", `lynvo_session=${session.id}`)
  return new Request(`https://lynvo.test${path}`, { ...init, headers })
}

// SAFETY: Callers provide the response body contract produced by the route under test.
const readJsonBody = async <Body>(response: Response): Promise<Body> =>
  (await response.json()) as Body

const emptyMetadataJson = () =>
  JSON.stringify({
    schemaVersion: 3,
    source: {},
    extraction: { extractedLinks: [] },
    playback: { openedUrls: [], resolvedMirrors: {} },
  })

describe("d1 data routes", () => {
  it("rejects unauthenticated requests with a session-expired failure", async () => {
    const response = await app.fetch(
      new Request("https://lynvo.test/api/data/links"),
      env
    )
    expect(response.status).toBe(401)
    const body = await readJsonBody<{ failure: { kind: string } }>(response)
    expect(body.failure.kind).toBe("session-expired")
  })

  it("rejects cross-origin mutations with a csrf failure", async () => {
    const user = await createUser()
    const session = await createSessionFor(user.id)
    const response = await app.fetch(
      dataApiRequest("/api/data/links/clear", session, {
        method: "POST",
        headers: { Origin: "https://evil.example" },
      }),
      env
    )
    expect(response.status).toBe(403)
    const body = await readJsonBody<{ failure: { kind: string } }>(response)
    expect(body.failure.kind).toBe("csrf-expired")
  })

  it("creates links through the API with replay dedupe and version echo", async () => {
    const user = await createUser()
    const sessionA = await createSessionFor(user.id)
    const sessionB = await createSessionFor(user.id)

    const listBefore = await app.fetch(
      dataApiRequest("/api/data/links", sessionB),
      env
    )
    expect(listBefore.headers.get(DATA_VERSION_RESPONSE_HEADER)).toBe("1")
    const beforeBody = await readJsonBody<{
      links: unknown[]
      dataVersion: number
    }>(listBefore)
    expect(beforeBody.links).toHaveLength(0)

    const operationId = crypto.randomUUID()
    const createResponse = await app.fetch(
      dataApiRequest("/api/data/links/create-or-update", sessionA, {
        method: "POST",
        body: JSON.stringify({
          operationId,
          url: "https://example.com/route-create",
          title: "Route created",
          meta: emptyMetadataJson(),
        }),
      }),
      env
    )
    expect(createResponse.status).toBe(200)
    const created = await readJsonBody<{
      id: string
      replayed: boolean
      dataVersion: number
    }>(createResponse)
    expect(created.replayed).toBe(false)
    expect(created.dataVersion).toBe(2)

    const replayResponse = await app.fetch(
      dataApiRequest("/api/data/links/create-or-update", sessionA, {
        method: "POST",
        body: JSON.stringify({
          operationId,
          url: "https://example.com/route-create",
          title: "Route created",
          meta: emptyMetadataJson(),
        }),
      }),
      env
    )
    const replayed = await readJsonBody<{
      id: string | null
      replayed: boolean
      dataVersion: number
    }>(replayResponse)
    expect(replayed.replayed).toBe(true)
    expect(replayed.id).toBe(created.id)
    expect(replayed.dataVersion).toBe(2)

    const listAfter = await app.fetch(
      dataApiRequest("/api/data/links", sessionB),
      env
    )
    const afterBody = await readJsonBody<{
      links: { id: string; url: string; title: string | null }[]
    }>(listAfter)
    expect(afterBody.links).toHaveLength(1)
    expect(afterBody.links[0]?.id).toBe(created.id)
    expect(afterBody.links[0]?.title).toBe("Route created")
    expect(listAfter.headers.get(DATA_VERSION_RESPONSE_HEADER)).toBe(
      String(replayed.dataVersion)
    )
  })

  it("refuses wrong-user access to link mutations", async () => {
    const owner = await createUser()
    const stranger = await createUser()
    const ownerSession = await createSessionFor(owner.id)
    const strangerSession = await createSessionFor(stranger.id)

    const createResponse = await app.fetch(
      dataApiRequest("/api/data/links/create-or-update", ownerSession, {
        method: "POST",
        body: JSON.stringify({
          operationId: crypto.randomUUID(),
          url: "https://example.com/owned",
          meta: emptyMetadataJson(),
        }),
      }),
      env
    )
    const created = await readJsonBody<{ id: string }>(createResponse)

    const deleteResponse = await app.fetch(
      dataApiRequest("/api/data/links/delete", strangerSession, {
        method: "POST",
        body: JSON.stringify({
          operationId: crypto.randomUUID(),
          id: created.id,
        }),
      }),
      env
    )
    expect(deleteResponse.status).toBe(404)
    const body = await readJsonBody<{ failure: { kind: string } }>(
      deleteResponse
    )
    expect(body.failure.kind).toBe("validation")

    const updateResponse = await app.fetch(
      dataApiRequest("/api/data/links/update-meta", strangerSession, {
        method: "POST",
        body: JSON.stringify({
          operationId: crypto.randomUUID(),
          id: created.id,
          meta: emptyMetadataJson(),
        }),
      }),
      env
    )
    expect(updateResponse.status).toBe(404)
  })

  it("applies metadata operations and reports the bumped version", async () => {
    const user = await createUser()
    const session = await createSessionFor(user.id)
    const createResponse = await app.fetch(
      dataApiRequest("/api/data/links/create-or-update", session, {
        method: "POST",
        body: JSON.stringify({
          operationId: crypto.randomUUID(),
          url: "https://example.com/opened",
          meta: emptyMetadataJson(),
        }),
      }),
      env
    )
    const created = await readJsonBody<{ id: string; dataVersion: number }>(
      createResponse
    )

    const markOpenedResponse = await app.fetch(
      dataApiRequest("/api/data/links/apply-metadata-operation", session, {
        method: "POST",
        body: JSON.stringify({
          operationId: crypto.randomUUID(),
          id: created.id,
          operation: {
            kind: "markOpened",
            linkUrl: "https://media.example/video.mp4",
          },
        }),
      }),
      env
    )
    expect(markOpenedResponse.status).toBe(200)
    const applied = await readJsonBody<{
      success: boolean
      dataVersion: number
    }>(markOpenedResponse)
    expect(applied.success).toBe(true)
    expect(applied.dataVersion).toBe(created.dataVersion + 1)
  })

  it("stores the picked artwork identity through the setArtwork operation", async () => {
    const user = await createUser()
    const session = await createSessionFor(user.id)
    const createResponse = await app.fetch(
      dataApiRequest("/api/data/links/create-or-update", session, {
        method: "POST",
        body: JSON.stringify({
          operationId: crypto.randomUUID(),
          url: "https://example.com/artwork",
          meta: emptyMetadataJson(),
        }),
      }),
      env
    )
    const created = await readJsonBody<{ id: string; dataVersion: number }>(
      createResponse
    )

    const setArtworkResponse = await app.fetch(
      dataApiRequest("/api/data/links/apply-metadata-operation", session, {
        method: "POST",
        body: JSON.stringify({
          operationId: crypto.randomUUID(),
          id: created.id,
          operation: {
            kind: "setArtwork",
            providerId: 42,
            title: "Test Feature",
            year: 2021,
            mediaKind: "movie",
          },
        }),
      }),
      env
    )
    expect(setArtworkResponse.status).toBe(200)
    const applied = await readJsonBody<{ success: boolean }>(setArtworkResponse)
    expect(applied.success).toBe(true)

    const row = await env.DB.prepare("SELECT meta_json FROM links WHERE id = ?")
      .bind(created.id)
      .first<{ meta_json: string }>()
    // SAFETY: meta_json was just written by createOrUpdate with this shape.
    const metadata = JSON.parse(row?.meta_json ?? "{}") as {
      artwork?: { providerId: number; mediaKind?: string }
    }
    expect(metadata.artwork?.providerId).toBe(42)
    expect(metadata.artwork?.mediaKind).toBe("movie")
  })

  it("maps oversized links to a link-too-large failure", async () => {
    const user = await createUser()
    const session = await createSessionFor(user.id)
    const paddedMetadata = JSON.stringify({
      schemaVersion: 3,
      source: { padding: "x".repeat(LINK_LIMIT_BYTES) },
      extraction: { extractedLinks: [] },
      playback: { openedUrls: [], resolvedMirrors: {} },
    })
    const response = await app.fetch(
      dataApiRequest("/api/data/links/create-or-update", session, {
        method: "POST",
        body: JSON.stringify({
          operationId: crypto.randomUUID(),
          url: "https://example.com/huge",
          meta: paddedMetadata,
        }),
      }),
      env
    )
    expect(response.status).toBe(422)
    const body = await readJsonBody<{
      failure: { kind: string; sizeBytes: number; limitBytes: number }
    }>(response)
    expect(body.failure.kind).toBe("link-too-large")
    expect(body.failure.limitBytes).toBe(LINK_LIMIT_BYTES)
  })

  it("deletes by id and clears all links through the API", async () => {
    const user = await createUser()
    const session = await createSessionFor(user.id)
    const createLinkByUrl = async (url: string) => {
      const response = await app.fetch(
        dataApiRequest("/api/data/links/create-or-update", session, {
          method: "POST",
          body: JSON.stringify({
            operationId: crypto.randomUUID(),
            url,
            meta: emptyMetadataJson(),
          }),
        }),
        env
      )
      return await readJsonBody<{ id: string; dataVersion: number }>(response)
    }
    const firstLink = await createLinkByUrl("https://example.com/first")
    const secondLink = await createLinkByUrl("https://example.com/second")

    const deleteResponse = await app.fetch(
      dataApiRequest("/api/data/links/delete", session, {
        method: "POST",
        body: JSON.stringify({
          operationId: crypto.randomUUID(),
          id: firstLink.id,
        }),
      }),
      env
    )
    const deleted = await readJsonBody<{
      success: boolean
      dataVersion: number
    }>(deleteResponse)
    expect(deleted.success).toBe(true)
    expect(deleted.dataVersion).toBeGreaterThan(secondLink.dataVersion)

    const clearResponse = await app.fetch(
      dataApiRequest("/api/data/links/clear", session, {
        method: "POST",
        body: JSON.stringify({ operationId: crypto.randomUUID() }),
      }),
      env
    )
    const cleared = await readJsonBody<{
      success: boolean
      deletedLinks: number
      dataVersion: number
    }>(clearResponse)
    expect(cleared.success).toBe(true)
    expect(cleared.deletedLinks).toBe(1)

    const listResponse = await app.fetch(
      dataApiRequest("/api/data/links", session),
      env
    )
    const list = await readJsonBody<{ links: unknown[] }>(listResponse)
    expect(list.links).toHaveLength(0)
  })

  it("reads usage metrics and storage settings through the API", async () => {
    const user = await createUser()
    const session = await createSessionFor(user.id)

    const usageResponse = await app.fetch(
      dataApiRequest("/api/data/usage", session),
      env
    )
    expect(usageResponse.status).toBe(200)
    const usage = await readJsonBody<{
      metrics: { id: string; used: number; limit: number }[]
    }>(usageResponse)
    expect(usage.metrics.length).toBeGreaterThanOrEqual(2)

    const settingsResponse = await app.fetch(
      dataApiRequest("/api/data/storage-settings", session),
      env
    )
    const settings = await readJsonBody<{
      retentionDays: number
      savedLinkCount: number
      storageLimitBytes: number
    }>(settingsResponse)
    expect(settings.retentionDays).toBe(30)
    expect(settings.savedLinkCount).toBe(0)

    const patchResponse = await app.fetch(
      dataApiRequest("/api/data/storage-settings", session, {
        method: "PATCH",
        body: JSON.stringify({ days: 7 }),
      }),
      env
    )
    expect(patchResponse.status).toBe(200)
    const patched = await readJsonBody<{
      success: boolean
      dataVersion: number
    }>(patchResponse)
    expect(patched.success).toBe(true)

    const invalidPatch = await app.fetch(
      dataApiRequest("/api/data/storage-settings", session, {
        method: "PATCH",
        body: JSON.stringify({ days: 10 }),
      }),
      env
    )
    expect(invalidPatch.status).toBe(400)
  })

  it("serves plugin server and domain reads plus lifecycle mutations", async () => {
    const user = await createUser()
    const session = await createSessionFor(user.id)
    const pluginServerId = `plugin-server-${crypto.randomUUID()}`
    await env.DB.prepare(
      "INSERT INTO user_plugin_servers (id, user_id, base_url, normalized_base_url, credential_status, manifest, enabled, priority, verification_status, created_at, updated_at) VALUES (?1, ?2, 'https://plugins.example', 'https://plugins.example', 'ready', '{}', 1, 0, 'unverified', ?3, ?3)"
    )
      .bind(pluginServerId, user.id, NOW)
      .run()

    const listServersResponse = await app.fetch(
      dataApiRequest("/api/data/plugin-servers", session),
      env
    )
    const servers = await readJsonBody<{
      servers: { id: string; enabled: boolean }[]
    }>(listServersResponse)
    expect(servers.servers.map((server) => server.id)).toContain(pluginServerId)

    const upsertDomainResponse = await app.fetch(
      dataApiRequest("/api/data/plugin-domains", session, {
        method: "POST",
        body: JSON.stringify({
          domain: "Example.COM",
          pluginServerId,
          pluginId: "test-plugin",
        }),
      }),
      env
    )
    expect(upsertDomainResponse.status).toBe(200)
    const upsertedDomain = await readJsonBody<{
      id: string
      dataVersion: number
    }>(upsertDomainResponse)

    const listDomainsResponse = await app.fetch(
      dataApiRequest("/api/data/plugin-domains", session),
      env
    )
    const domains = await readJsonBody<{
      domains: { id: string; domain: string }[]
    }>(listDomainsResponse)
    expect(domains.domains[0]?.domain).toBe("example.com")

    const toggleResponse = await app.fetch(
      dataApiRequest(
        `/api/data/plugin-servers/${pluginServerId}/enabled`,
        session,
        { method: "POST", body: JSON.stringify({ enabled: false }) }
      ),
      env
    )
    expect(toggleResponse.status).toBe(200)

    const deleteDomainResponse = await app.fetch(
      dataApiRequest(`/api/data/plugin-domains/${upsertedDomain.id}`, session, {
        method: "DELETE",
      }),
      env
    )
    expect(deleteDomainResponse.status).toBe(200)

    const deleteServerResponse = await app.fetch(
      dataApiRequest(`/api/data/plugin-servers/${pluginServerId}`, session, {
        method: "DELETE",
      }),
      env
    )
    expect(deleteServerResponse.status).toBe(200)
  })

  it("moves remote commands from enqueue through claim to result", async () => {
    const owner = await createUser()
    const senderSession = await createSessionFor(owner.id)
    const receiverSession = await createSessionFor(owner.id)

    const enqueueResponse = await app.fetch(
      dataApiRequest("/api/data/remote-commands/enqueue", senderSession, {
        method: "POST",
        body: JSON.stringify({
          targetSessionId: receiverSession.id,
          targetReceiverId: "receiver-1",
          command: "play",
          payload: "{}",
        }),
      }),
      env
    )
    expect(enqueueResponse.status).toBe(200)
    const enqueued = await readJsonBody<{ id: string; dataVersion: number }>(
      enqueueResponse
    )

    const claimResponse = await app.fetch(
      dataApiRequest("/api/data/remote-commands/claim", receiverSession, {
        method: "POST",
        body: JSON.stringify({ receiverId: "receiver-1" }),
      }),
      env
    )
    expect(claimResponse.status).toBe(200)
    const claim = await readJsonBody<{
      commands: {
        id: string
        claimToken: string
        command: string
        payload: string
      }[]
    }>(claimResponse)
    expect(claim.commands).toHaveLength(1)
    expect(claim.commands[0]?.id).toBe(enqueued.id)

    const resultResponse = await app.fetch(
      dataApiRequest("/api/data/remote-commands/result", receiverSession, {
        method: "POST",
        body: JSON.stringify({
          id: enqueued.id,
          receiverId: "receiver-1",
          claimToken: claim.commands[0]?.claimToken ?? "",
          result: "applied",
        }),
      }),
      env
    )
    expect(resultResponse.status).toBe(200)
    const reported = await readJsonBody<{ success: boolean }>(resultResponse)
    expect(reported.success).toBe(true)
  })

  it("advances the echoed version for every account session after a mutation", async () => {
    const user = await createUser()
    const sessionA = await createSessionFor(user.id)
    const sessionB = await createSessionFor(user.id)

    const versionBefore = await getDataVersion(env.DB, user.id)
    await app.fetch(
      dataApiRequest("/api/data/links/create-or-update", sessionA, {
        method: "POST",
        body: JSON.stringify({
          operationId: crypto.randomUUID(),
          url: "https://example.com/converge",
          meta: emptyMetadataJson(),
        }),
      }),
      env
    )

    const listResponse = await app.fetch(
      dataApiRequest("/api/data/links", sessionB),
      env
    )
    const list = await readJsonBody<{ dataVersion?: number }>(listResponse)
    const echoedVersion = Number(
      listResponse.headers.get(DATA_VERSION_RESPONSE_HEADER)
    )
    expect(echoedVersion).toBe(versionBefore + 1)
    expect(echoedVersion).toBeGreaterThan(1)
    expect(list.dataVersion === undefined || list.dataVersion > 0).toBe(true)
  })
})
