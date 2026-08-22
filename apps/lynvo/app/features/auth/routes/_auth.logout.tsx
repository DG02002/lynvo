import * as React from "react"
import { signOut } from "~/lib/session-http"

export default function Logout() {
  React.useEffect(() => {
    void signOut().finally(() => {
      window.location.href = "/"
    })
  }, [])

  return null
}
