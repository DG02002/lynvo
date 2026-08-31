export const toProviderUser = (
  user: { readonly sub: string; readonly sid?: string } | null
) => (user ? { id: user.sub, sessionId: user.sid } : null)
