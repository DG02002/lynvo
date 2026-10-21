import { clearUserScopedStorage } from "~/context/remote-control/storage"
import { authPaths } from "~/lib/paths"

export const clearRevokedSessionState = (
  storage: Storage,
  location: Pick<Location, "assign">,
  userId: string
) => {
  clearUserScopedStorage(storage, userId)
  location.assign(authPaths.signIn)
}
