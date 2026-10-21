import { clearUserScopedStorage } from "~/context/remote-control/storage"
import { authPaths } from "~/lib/paths"
import { clearRevokedSessionState } from "~/root/session-revocation"

import { createMemoryStorage } from "./memory-storage"

describe("authoritative session revocation", () => {
  it("clears only keys that contain the revoked user ID", () => {
    const storage = createMemoryStorage()
    storage.setItem("lynvo_remote_session_id:user-one:session-one", "one")
    storage.setItem("lynvo_remote_session_id:user-two:session-two", "two")
    storage.setItem("theme", "dark")

    clearUserScopedStorage(storage, "user-one")

    expect(
      storage.getItem("lynvo_remote_session_id:user-one:session-one")
    ).toBeNull()
    expect(
      storage.getItem("lynvo_remote_session_id:user-two:session-two")
    ).toBe("two")
    expect(storage.getItem("theme")).toBe("dark")
  })

  it("clears account state and navigates to the registered sign-in route", () => {
    const storage = createMemoryStorage()
    storage.setItem("lynvo:user-one:remote", "private")
    storage.setItem("lynvo:user-two:remote", "preserved")
    const assign = vi.fn()

    clearRevokedSessionState(storage, { assign }, "user-one")

    expect(storage.getItem("lynvo:user-one:remote")).toBeNull()
    expect(storage.getItem("lynvo:user-two:remote")).toBe("preserved")
    expect(assign).toHaveBeenCalledWith(authPaths.signIn)
  })
})
