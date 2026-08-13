import { SignInForm } from "~/components/auth/SignInForm"
import { authCopy } from "~/features/auth/auth.copy"
import { getUserSession, requireGuestOrRedirect } from "~/lib/auth"
import { getServerEnv } from "~/lib/env.server"
import type { Route } from "./+types/_auth.log-in"

export function meta() {
  return [
    { title: authCopy.signin.metaTitle },
    { name: "description", content: authCopy.signin.metaDescription },
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

export default function SignIn() {
  return <SignInForm />
}
