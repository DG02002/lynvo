import { authPaths } from "~/lib/paths"

export const clearRevokedSessionState = (
  storage: Storage,
  location: Pick<Location, "assign">,
  userId: string
) => {
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index)
    if (key?.includes(userId)) {
      storage.removeItem(key)
    }
  }
  location.assign(authPaths.signIn)
}
