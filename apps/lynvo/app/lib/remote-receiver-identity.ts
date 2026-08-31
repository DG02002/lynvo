const readIdentityMeta = (name: string) =>
  document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content

// Receiver ids are per page instance: duplicating a tab must not reuse the
// same id, or the two tabs would endlessly replace each other's socket.
let pageReceiverId: string | undefined

export const getRemoteReceiverId = (): string | undefined => {
  if (globalThis.document === undefined) {
    return undefined
  }
  const userId = readIdentityMeta("lynvo-user-id")
  const sessionId = readIdentityMeta("lynvo-session-id")
  if (!userId || !sessionId) {
    return undefined
  }
  pageReceiverId ??= crypto.randomUUID()
  return pageReceiverId
}
