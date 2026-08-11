const RECEIVER_KEY_PREFIX = "lynvo:remote-receiver:v1:"

const readIdentityMeta = (name: string) =>
  document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content

export const getRemoteReceiverId = (): string | undefined => {
  if (typeof document === "undefined") {
    return undefined
  }
  const userId = readIdentityMeta("lynvo-user-id")
  const sessionId = readIdentityMeta("lynvo-session-id")
  if (!userId || !sessionId) {
    return undefined
  }
  const key = `${RECEIVER_KEY_PREFIX}${userId}:${sessionId}`
  const existing = sessionStorage.getItem(key)
  if (existing) {
    return existing
  }
  const receiverId = crypto.randomUUID()
  sessionStorage.setItem(key, receiverId)
  return receiverId
}
