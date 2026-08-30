import DeviceApproval from "~/components/auth/device-approval"
import {
  getUserSession,
  responseWithSession,
  requireUserOrRedirect,
} from "~/lib/auth"
import { getServerEnv } from "~/lib/env.server"
import type { Route } from "./+types/_auth.device"

export function meta(_: Route.MetaArgs) {
  return [{ title: "Approve login | Lynvo" }]
}

export async function loader({
  request,
  context,
}: Route.LoaderArgs): Promise<any> {
  const env = getServerEnv(context)
  const sessionResult = await getUserSession(request, env)

  const url = new URL(request.url)
  const code = url.searchParams.get("user_code")
  if (code && !sessionResult.user) {
    requireUserOrRedirect(sessionResult, `/auth/device?user_code=${code}`)
  }

  return responseWithSession({
    responseData: { user: sessionResult.user },
    sessionResult,
    request,
  })
}

export default function Device() {
  return <DeviceApproval />
}
