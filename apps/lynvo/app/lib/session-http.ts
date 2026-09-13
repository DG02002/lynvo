import { requestSameOrigin } from "./api/client"

export const signOut = async (): Promise<void> => {
  const response = await requestSameOrigin("/api/auth/session", {
    method: "DELETE",
  })
  if (!response.ok) {
    throw new Error("Unable to revoke the server session")
  }
}
