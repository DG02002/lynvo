import { sessionIdentityHeaders } from "./session-identity"

export const revokeSession = async (): Promise<void> => {
  const headers = sessionIdentityHeaders()
  const options: RequestInit = {
    method: "DELETE",
    credentials: "same-origin",
  }
  if (Object.keys(headers).length > 0) {
    options.headers = headers
  }
  const response = await fetch("/api/auth/session", options)
  if (!response.ok) {
    throw new Error("Unable to revoke the server session")
  }
}

export const signOut = revokeSession
