import { data } from "react-router"
import {
  getUserSession,
  responseWithSession,
  requireUserOrRedirect,
} from "~/lib/auth"
import { getServerEnv } from "~/lib/env.server"
import { getD1Database } from "../../../../workers/d1/db"
import { getDataVersion } from "../../../../workers/d1/data-version"
import { listSavedLinks } from "../../../../workers/d1/links"
import { listTitleGroups } from "../../../../workers/d1/title-groups"
import type { Route } from "./+types/_site.save"

export const saveRouteLoader = async (args: Route.LoaderArgs) => {
  const request = args.request
  const env = getServerEnv(args.context)
  const sessionResult = await getUserSession(request, env)

  const pathname = new URL(request.url).pathname
  const user = requireUserOrRedirect(sessionResult, pathname)
  const database = getD1Database(env)
  if (!database) {
    throw data(
      { error: "Data storage is temporarily unavailable." },
      { status: 503 }
    )
  }
  const now = Date.now()
  const [savedLinks, titleProjection] = await Promise.all([
    listSavedLinks(database, user.sub, now),
    listTitleGroups(database, user.sub, now),
  ])
  const dataVersion = await getDataVersion(database, user.sub)

  return responseWithSession(
    {
      user: sessionResult.user,
      savedLinks: savedLinks.results,
      titleProjection,
      dataVersion,
    },
    sessionResult,
    request
  )
}
