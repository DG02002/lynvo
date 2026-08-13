interface SessionIdentity {
  readonly userId: string
  readonly sessionId: string
}

const readIdentityMeta = (name: string) =>
  globalThis.document === undefined
    ? undefined
    : document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content

export const readRenderedSessionIdentity = (): SessionIdentity | undefined => {
  const userId = readIdentityMeta("lynvo-user-id")
  const sessionId = readIdentityMeta("lynvo-session-id")
  return userId && sessionId ? { userId, sessionId } : undefined
}

export const bindSessionIdentityToUrl = (
  url: URL,
  identity = readRenderedSessionIdentity()
) => {
  if (identity) {
    url.searchParams.set("expectedUserId", identity.userId)
    url.searchParams.set("expectedSessionId", identity.sessionId)
  }
  return url
}

export const sessionIdentityHeaders = (
  identity = readRenderedSessionIdentity()
): Record<string, string> =>
  identity
    ? {
        "X-Lynvo-Expected-User-Id": identity.userId,
        "X-Lynvo-Expected-Session-Id": identity.sessionId,
      }
    : {}
