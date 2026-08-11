import { sessionIdentityHeaders } from "./session-identity"

export const revokeWorkerSession = async (): Promise<void> => {
  const headers = sessionIdentityHeaders()
  const response = await fetch("/api/auth/session", {
    method: "DELETE",
    credentials: "same-origin",
    ...(Object.keys(headers).length > 0 ? { headers } : {}),
  })
  if (!response.ok) {
    throw new Error("Unable to revoke the server session")
  }
}

export const signOutWithWorkerSession = revokeWorkerSession
