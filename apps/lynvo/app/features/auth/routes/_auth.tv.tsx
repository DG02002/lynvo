import { useLoaderData } from "react-router"
import TvAuth from "~/components/auth/TvAuth"
import {
  getUserSession,
  responseWithSession,
  requireUserOrRedirect,
} from "~/lib/auth"
import { getServerEnv } from "~/lib/env.server"
import type { Route } from "./+types/_auth.tv"

export function meta(_: Route.MetaArgs) {
  return [{ title: "TV Sign In | Lynvo" }]
}

export async function loader(args: Route.LoaderArgs): Promise<any> {
  const request = args.request
  const env = getServerEnv(args.context)
  const sessionResult = await getUserSession(request, env)

  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  if (code && !sessionResult.user) {
    requireUserOrRedirect(sessionResult, `/tv?code=${code}`)
  }

  return responseWithSession(
    { user: sessionResult.user },
    sessionResult,
    request
  )
}

export default function Tv() {
  const { user } = useLoaderData<typeof loader>()
  return <TvAuth user={user} />
}
