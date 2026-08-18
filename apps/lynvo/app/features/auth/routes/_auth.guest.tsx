import { Outlet } from "react-router"
import { getUserSession, requireGuestOrRedirect } from "~/lib/auth"
import { getServerEnv } from "~/lib/env.server"
import type { Route } from "./+types/_auth.guest"

export async function loader(args: Route.LoaderArgs) {
  const sessionResult = await getUserSession(
    args.request,
    getServerEnv(args.context)
  )
  requireGuestOrRedirect(sessionResult, args.request)
  return null
}

export default function GuestAuthLayout() {
  return <Outlet />
}
