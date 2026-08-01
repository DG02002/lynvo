import * as React from "react"
import { signOutWithWorkerSession } from "~/lib/worker-auth-session-http"

export default function Logout() {
  React.useEffect(() => {
    void signOutWithWorkerSession().finally(() => {
      window.location.href = "/"
    })
  }, [])

  return null
}
