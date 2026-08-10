import type { QueryClient } from "@tanstack/react-query"
import { authPaths } from "~/lib/paths"

export const clearRevokedSessionState = (
  queryClient: QueryClient,
  storage: Storage,
  location: Pick<Location, "assign">,
  userId: string
) => {
  queryClient.clear()
  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index)
    if (key?.includes(userId)) {
      storage.removeItem(key)
    }
  }
  location.assign(authPaths.signIn)
}
