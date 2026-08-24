import { data, redirect, type RouterContextProvider } from "react-router"
import {
  getUserSession,
  requireUserOrRedirect,
  responseWithSession,
} from "~/lib/auth"
import { getServerEnv } from "~/lib/env.server"
import { getD1Database } from "../../../../workers/d1/db"
import { getDataVersion } from "../../../../workers/d1/data-version"
import { getTitleGroupById } from "../../../../workers/d1/title-groups"
import { getTitleGroupHref } from "~/features/links/title-grouping/title-group-href"

interface SaveTitleRouteLoaderArgs {
  readonly request: Request
  readonly context: Readonly<RouterContextProvider>
  readonly params: { readonly titleGroupId: string }
}

interface SaveTitleRouteLoaderOptions {
  readonly expectedMediaKind: TitleGroupProjection["mediaKind"]
}

export const createSaveTitleRouteLoader =
  ({ expectedMediaKind }: SaveTitleRouteLoaderOptions) =>
  async (args: SaveTitleRouteLoaderArgs) => {
    const sessionResult = await getUserSession(
      args.request,
      getServerEnv(args.context)
    )
    const user = requireUserOrRedirect(
      sessionResult,
      new URL(args.request.url).pathname
    )
    const database = getD1Database(getServerEnv(args.context))
    if (!database) {
      throw data(
        { error: "Data storage is temporarily unavailable." },
        { status: 503 }
      )
    }
    const group = await getTitleGroupById(
      database,
      user.sub,
      args.params.titleGroupId
    )
    if (!group) {
      throw data(null, { status: 404 })
    }
    if (group.mediaKind !== expectedMediaKind) {
      throw redirect(
        group.id ? getTitleGroupHref(group.id, group.mediaKind) : "/save"
      )
    }
    return responseWithSession(
      {
        group,
        dataVersion: await getDataVersion(database, user.sub),
      },
      sessionResult,
      args.request
    )
  }
