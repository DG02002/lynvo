import { env } from "cloudflare:workers"
import { describe, expect, it } from "vitest"
import app from "../../workers/app"
import { DATA_VERSION_RESPONSE_HEADER } from "../../workers/constants"
import { createSession } from "../../workers/d1/sessions"
import { insertGoogleUser } from "../../workers/d1/users"

const NOW = 1_750_000_000_000

const createUser = async () =>
  insertGoogleUser(env.DB, {
    googleSubject: `subject-${crypto.randomUUID()}`,
    email: `title-group-route-${crypto.randomUUID()}@example.com`,
    now: NOW,
  })

const createSessionFor = async (userId: string) =>
  createSession(env.DB, { userId, now: Date.now() })

const requestFor = (path: string, session: { readonly id: string }): Request =>
  new Request(`https://lynvo.test${path}`, {
    headers: { Cookie: `lynvo_session=${session.id}` },
  })

const mediaMetadata = () =>
  JSON.stringify({
    schemaVersion: 3,
    source: {},
    extraction: {
      extractedLinks: [
        {
          nodeKey: "movie-node",
          url: "https://media.example/movie.mkv",
          label: "Example Movie (2026) 1080p.mkv",
          type: "file",
          mediaNodeKind: "playable",
        },
      ],
    },
    playback: { openedUrls: [], openedIds: [], resolvedMirrors: {} },
  })

describe("title group data routes", () => {
  it("requires an authenticated session", async () => {
    const response = await app.fetch(
      new Request("https://lynvo.test/api/data/title-groups"),
      env
    )
    expect(response.status).toBe(401)
  })

  it("reads an owned title group with a monotonic data version", async () => {
    const owner = await createUser()
    const stranger = await createUser()
    const ownerSession = await createSessionFor(owner.id)
    const strangerSession = await createSessionFor(stranger.id)
    const createResponse = await app.fetch(
      new Request("https://lynvo.test/api/data/links/create-or-update", {
        method: "POST",
        headers: {
          Cookie: `lynvo_session=${ownerSession.id}`,
          Origin: "https://lynvo.test",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          operationId: crypto.randomUUID(),
          url: "https://source.example/movie",
          meta: mediaMetadata(),
        }),
      }),
      env
    )
    expect(createResponse.status).toBe(200)

    const listResponse = await app.fetch(
      requestFor("/api/data/title-groups", ownerSession),
      env
    )
    // SAFETY: The list route contract is asserted immediately below.
    const listBody = (await listResponse.json()) as {
      readonly dateGroups: readonly {
        readonly groups: readonly { readonly id?: string }[]
      }[]
      readonly dataVersion: number
    }
    const groupId = listBody.dateGroups[0]?.groups[0]?.id ?? ""

    expect(listResponse.status).toBe(200)
    expect(listResponse.headers.get(DATA_VERSION_RESPONSE_HEADER)).toBe(
      String(listBody.dataVersion)
    )
    expect(groupId).not.toBe("")
    expect(groupId).not.toContain("https://")

    const detailResponse = await app.fetch(
      requestFor(
        `/api/data/title-groups/${encodeURIComponent(groupId)}`,
        ownerSession
      ),
      env
    )
    expect(detailResponse.status).toBe(200)
    // SAFETY: The detail route contract is asserted by the equality check.
    expect(
      (
        (await detailResponse.json()) as {
          readonly group: { readonly id: string }
        }
      ).group.id
    ).toBe(groupId)

    const strangerResponse = await app.fetch(
      requestFor(
        `/api/data/title-groups/${encodeURIComponent(groupId)}`,
        strangerSession
      ),
      env
    )
    expect(strangerResponse.status).toBe(404)

    const missingResponse = await app.fetch(
      requestFor("/api/data/title-groups/missing-title-group", ownerSession),
      env
    )
    expect(missingResponse.status).toBe(404)
  })
})
