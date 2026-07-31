import * as React from "react"
import { useAuthActions } from "@convex-dev/auth/react"
import { signOutWithWorkerSession } from "~/lib/worker-auth-session-http"

export default function Logout() {
  const { signOut } = useAuthActions()

  React.useEffect(() => {
    void signOutWithWorkerSession(signOut).finally(() => {
      window.location.href = "/"
    })
  }, [signOut])

  return null
}
