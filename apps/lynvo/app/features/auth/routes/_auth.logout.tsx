import * as React from "react"
import { useAuthActions } from "@convex-dev/auth/react"

export default function Logout() {
  const { signOut } = useAuthActions()

  React.useEffect(() => {
    void signOut().finally(() => {
      window.location.href = "/"
    })
  }, [signOut])

  return null
}
