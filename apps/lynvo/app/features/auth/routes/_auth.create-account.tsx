import { SignupForm } from "~/components/auth/SignupForm"
import { authCopy } from "~/features/auth/auth.copy"
import { getUserSession, requireGuestOrRedirect } from "~/lib/auth"
import { getServerEnv } from "~/lib/env.server"
import type { Route } from "./+types/_auth.create-account"

export function meta() {
  return [
    { title: authCopy.signup.metaTitle },
    { name: "description", content: authCopy.signup.metaDescription },
  ]
}

export async function loader(args: Route.LoaderArgs) {
  const sessionResult = await getUserSession(
    args.request,
    getServerEnv(args.context)
  )
  requireGuestOrRedirect(sessionResult, args.request)
  return null
}

export default function Signup() {
  return <SignupForm />
}
