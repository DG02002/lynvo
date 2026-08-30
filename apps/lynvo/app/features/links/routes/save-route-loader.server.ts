import { data } from "react-router"
import {
  getUserSession,
  responseWithSession,
  requireUserOrRedirect,
} from "~/lib/auth"
import { getServerEnv } from "~/lib/env.server"
import { getD1Database } from "../../../../workers/d1/db"
import { listSavedLinksWithDataVersion } from "../../../../workers/d1/links"
import type { Route } from "./+types/_site.save"

export const saveRouteLoader = async ({
  request,
  context,
}: Route.LoaderArgs) => {
  const env = getServerEnv(context)
  const sessionResult = await getUserSession(request, env)

  const { pathname } = new URL(request.url)
  const user = requireUserOrRedirect(sessionResult, pathname)
  const database = getD1Database(env)
  if (!database) {
    throw data(
      { error: "Data storage is temporarily unavailable." },
      { status: 503 }
    )
  }
  const { results: savedLinks, dataVersion } =
    await listSavedLinksWithDataVersion(database, user.sub, Date.now())

  return responseWithSession({
    responseData: {
      user: sessionResult.user,
      savedLinks,
      dataVersion,
    },
    sessionResult,
    request,
  })
}
