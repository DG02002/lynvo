import { redirect } from "react-router"
import { policyPaths } from "~/lib/paths"

export function loader() {
  return redirect(policyPaths.termsOfUse)
}

export default function TermsRedirect() {
  return null
}
