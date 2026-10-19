import { env } from "cloudflare:workers"
import { Schema } from "effect"
import { describe, expect, it, vi } from "vitest"

import { DATA_VERSION_RESPONSE_HEADER } from "../../app/lib/constants"
import {
  dataChangedRealtimeMessageSchema,
  type DataChangedRealtimeMessage,
} from "../../shared/realtime-messages"
import app from "../../workers/app"
import { getDataVersion } from "../../workers/d1/data-version"
import { createSession } from "../../workers/d1/sessions"
import { getStorageLedger } from "../../workers/d1/storage-ledger"
import {
  getUserPlayerPreferences,
  insertGoogleUser,
  updateUserPlayerPreferences,
} from "../../workers/d1/users"
import { UserRealtimeRoom } from "../../workers/realtime/user-realtime-room"
import { buildAuthenticatedWorkerRequest } from "../support/worker-route"

const NOW = 1_750_000_000_000

const createUser = async () =>
  insertGoogleUser(env.DB, {
    googleSubject: `subject-${crypto.randomUUID()}`,
    email: "player-prefs@example.com",
    now: NOW,
  })

describe("d1 player preferences", () => {
  it("returns empty preferences for a fresh account", async () => {
    const user = await createUser()

    await expect(getUserPlayerPreferences(env.DB, user.id)).resolves.toEqual({})
  })

  it("stores and returns both player selections", async () => {
    const user = await createUser()

    await updateUserPlayerPreferences(env.DB, user.id, {
      rangeSupportedPlayerId: "vlc",
      rangeUnsupportedPlayerId: "mx",
      now: NOW,
    })

    await expect(getUserPlayerPreferences(env.DB, user.id)).resolves.toEqual({
      rangeSupportedPlayerId: "vlc",
      rangeUnsupportedPlayerId: "mx",
    })
  })

  it("patches one selection without clearing the other", async () => {
    const user = await createUser()
    await updateUserPlayerPreferences(env.DB, user.id, {
      rangeSupportedPlayerId: "just",
      rangeUnsupportedPlayerId: "mpv",
      now: NOW,
    })

    await updateUserPlayerPreferences(env.DB, user.id, {
      rangeSupportedPlayerId: "vlc",
      now: NOW + 1_000,
    })

    await expect(getUserPlayerPreferences(env.DB, user.id)).resolves.toEqual({
      rangeSupportedPlayerId: "vlc",
      rangeUnsupportedPlayerId: "mpv",
    })
  })

  it("rejects an unknown player id without writing", async () => {
    const user = await createUser()

    await expect(
      updateUserPlayerPreferences(env.DB, user.id, {
        rangeSupportedPlayerId: "youtube",
        now: NOW,
      })
    ).rejects.toThrow(
      "Choose Just (Video) Player, VLC for Android, MPV, or MX Player"
    )
    await expect(getUserPlayerPreferences(env.DB, user.id)).resolves.toEqual({})
  })

  it("keeps the data version stable when nothing changes", async () => {
    const user = await createUser()
    const first = await updateUserPlayerPreferences(env.DB, user.id, {
      rangeSupportedPlayerId: "vlc",
      now: NOW,
    })
    const unchanged = await updateUserPlayerPreferences(env.DB, user.id, {
      rangeSupportedPlayerId: "vlc",
      now: NOW + 1_000,
    })

    expect(first.dataVersion).toBeGreaterThan(1)
    expect(unchanged.dataVersion).toBe(first.dataVersion)
  })

  it("tracks profile bytes in the storage ledger", async () => {
    const user = await createUser()
    const beforeWrite = await getStorageLedger(env.DB, user.id)

    await updateUserPlayerPreferences(env.DB, user.id, {
      rangeSupportedPlayerId: "vlc",
      rangeUnsupportedPlayerId: "mx",
      now: NOW,
    })
    const afterWrite = await getStorageLedger(env.DB, user.id)

    expect(afterWrite?.profileBytes).toBeGreaterThan(
      beforeWrite?.profileBytes ?? 0
    )
  })

  it("pushes an Effect mutation's returned version to a connected session", async () => {
    const user = await createUser()
    const session = await createSession(env.DB, {
      userId: user.id,
      now: Date.now(),
    })
    let deliverMessage: (message: DataChangedRealtimeMessage) => void = () =>
      undefined
    const dataChanged = new Promise<DataChangedRealtimeMessage>((resolve) => {
      deliverMessage = resolve
    })
    // SAFETY: The room fetch path only needs getWebSockets for this notify request; the socket double captures its actual send payload.
    const room = Object.create(UserRealtimeRoom.prototype) as UserRealtimeRoom
    const socket = {
      send: (serialized: string) => {
        const message = Schema.decodeUnknownSync(
          dataChangedRealtimeMessageSchema
        )(JSON.parse(serialized))
        deliverMessage(message)
      },
    }
    Reflect.set(room, "ctx", { getWebSockets: () => [socket] })

    // SAFETY: The route test provides Miniflare D1 and routes the push through the real UserRealtimeRoom handler.
    const testEnvironment = {
      ...env,
      USER_REALTIME_ROOM: {
        getByName: () => ({
          fetch: async (input: RequestInfo | URL) => {
            return room.fetch(new Request(input))
          },
        }),
      },
    } as Env

    const response = await app.fetch(
      await buildAuthenticatedWorkerRequest("/api/settings/player", {
        method: "PATCH",
        body: { rangeSupportedPlayerId: "vlc" },
        userId: user.id,
        sessionId: session.id,
        sessionCookieValue: session.id,
      }),
      testEnvironment
    )
    expect(response.status).toBe(200)
    // SAFETY: The request is validated by the Effect endpoint schema under test.
    const result = (await response.json()) as {
      success: boolean
      dataVersion: number
    }
    expect(result.success).toBe(true)
    expect(response.headers.get(DATA_VERSION_RESPONSE_HEADER)).toBe(
      String(result.dataVersion)
    )
    await expect(dataChanged).resolves.toEqual({
      type: "data-changed",
      payload: { version: result.dataVersion },
    })
  })

  it("keeps an Effect mutation successful when the realtime room is unavailable", async () => {
    const user = await createUser()
    const session = await createSession(env.DB, {
      userId: user.id,
      now: Date.now(),
    })
    const warning = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined)

    try {
      const response = await app.fetch(
        await buildAuthenticatedWorkerRequest("/api/settings/player", {
          method: "PATCH",
          body: { rangeSupportedPlayerId: "vlc" },
          userId: user.id,
          sessionId: session.id,
          sessionCookieValue: session.id,
        }),
        // SAFETY: Preserve the real Miniflare D1 and bindings while replacing only the realtime namespace with a failing transport.
        {
          ...env,
          USER_REALTIME_ROOM: {
            getByName: () => ({
              fetch: async () => {
                throw new Error("room unavailable")
              },
            }),
          },
        } as Env
      )

      expect(response.status).toBe(200)
      // SAFETY: The request is validated by the Effect endpoint schema under test.
      const result = (await response.json()) as {
        success: boolean
        dataVersion: number
      }
      expect(result.success).toBe(true)
      expect(result.dataVersion).toBe(await getDataVersion(env.DB, user.id))
      expect(warning).toHaveBeenCalledWith("data_changed_push_failed", {
        user_id: user.id,
        version: result.dataVersion,
      })
    } finally {
      warning.mockRestore()
    }
  })
})
