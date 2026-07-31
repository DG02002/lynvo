export const revokeWorkerSession = async (): Promise<void> => {
  const response = await fetch("/api/auth/session", {
    method: "DELETE",
    credentials: "same-origin",
  })
  if (!response.ok) {
    throw new Error("Unable to revoke the server session")
  }
}

export const signOutWithWorkerSession = async (
  signOut: () => Promise<void>
): Promise<void> => {
  await revokeWorkerSession()
  await signOut()
}
