import { describe, expect, it, vi } from "vitest"
import {
  deleteUserAccountData,
  replacePasswordAndInvalidateOtherSessions,
} from "../convex/accountLifecycle"
import { buildPlayerPreferencesPatch } from "../convex/userPreferences"

describe("account lifecycle", () => {
  it("replaces the password before invalidating other sessions", async () => {
    const transitions: string[] = []
    await replacePasswordAndInvalidateOtherSessions(
      async () => transitions.push("password-replaced"),
      async () => transitions.push("other-sessions-invalidated")
    )
    expect(transitions).toEqual([
      "password-replaced",
      "other-sessions-invalidated",
    ])
  })

  it("does not invalidate sessions when password replacement fails", async () => {
    const invalidate = vi.fn()
    await expect(
      replacePasswordAndInvalidateOtherSessions(async () => {
        throw new Error("incorrect password")
      }, invalidate)
    ).rejects.toThrow("incorrect password")
    expect(invalidate).not.toHaveBeenCalled()
  })

  it("validates player preferences as one policy", () => {
    expect(
      buildPlayerPreferencesPatch({
        rangeSupportedPlayerId: "vlc",
        rangeUnsupportedPlayerId: "mx",
      })
    ).toEqual({
      rangeSupportedPlayerId: "vlc",
      rangeUnsupportedPlayerId: "mx",
    })
    expect(() =>
      buildPlayerPreferencesPatch({ rangeSupportedPlayerId: "unknown" })
    ).toThrow("Choose a supported player")
  })

  it("deletes only refresh tokens belonging to the target user's sessions", async () => {
    const deletedIds: string[] = []
    const documentsByTable = {
      authSessions: [{ _id: "session-user-1", userId: "user-1" }],
      authRefreshTokens: [
        { _id: "token-user-1", sessionId: "session-user-1" },
        { _id: "token-user-2", sessionId: "session-user-2" },
      ],
      authVerifiers: [],
      authVerificationCodes: [],
      links: [],
      userWorkers: [],
      userPluginDomains: [],
      userPluginCredentials: [],
      deviceCodes: [],
      authAccounts: [],
      remoteCommands: [],
      usageCounters: [],
      userStorageLedgers: [],
      accountCapacity: [],
    }
    const createQuery = (tableName: keyof typeof documentsByTable) => ({
      withIndex: (
        _indexName: string,
        select: (queryBuilder: {
          eq: (_field: string, value: string) => unknown
        }) => unknown
      ) => {
        let selectedValue = ""
        select({
          eq: (_field, value) => {
            selectedValue = value
          },
        })
        return {
          take: async () =>
            tableName === "authRefreshTokens"
              ? documentsByTable.authRefreshTokens.filter(
                  (token) => token.sessionId === selectedValue
                )
              : documentsByTable[tableName],
        }
      },
    })
    const context = {
      db: {
        query: createQuery,
        get: async (_tableName: string, _id: string) => ({ _id: "user-1" }),
        delete: async (_tableName: string, id: string) => {
          deletedIds.push(id)
        },
      },
    }

    await deleteUserAccountData(context as never, "user-1" as never)

    expect(deletedIds).toContain("token-user-1")
    expect(deletedIds).not.toContain("token-user-2")
  })
})
