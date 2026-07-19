import SaveList from "~/components/save-list"
import {
  getUserSession,
  responseWithSession,
  requireUserOrRedirect,
} from "~/lib/auth"
import { getServerEnv } from "~/lib/env.server"
import type { Route } from "./+types/_site.save"

export const meta = (_: Route.MetaArgs) => [{ title: "Save | Lynvo" }]

export const loader = async (args: Route.LoaderArgs) => {
  const request = args.request
  const env = getServerEnv(args.context)
  const sessionResult = await getUserSession(request, env)

  const pathname = new URL(request.url).pathname
  requireUserOrRedirect(sessionResult, pathname)

  return responseWithSession(
    { user: sessionResult.user },
    sessionResult,
    request
  )
}

const SaveRoute = () => <SaveList />

export default SaveRoute
