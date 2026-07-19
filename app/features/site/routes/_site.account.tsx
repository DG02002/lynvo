import { redirect } from "react-router"
import type { Route } from "./+types/_site.account"
import { sitePaths } from "~/lib/paths"

export function meta(_: Route.MetaArgs) {
  return [{ title: "Settings | Lynvo" }]
}

export async function loader(_: Route.LoaderArgs) {
  throw redirect(sitePaths.settings)
}

export async function action(_: Route.ActionArgs) {
  throw redirect(sitePaths.settings)
}

export default function AccountRedirect() {
  return null
}
