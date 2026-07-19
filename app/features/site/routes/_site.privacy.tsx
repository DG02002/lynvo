import { redirect } from "react-router"
import { policyPaths } from "~/lib/paths"

export function loader() {
  return redirect(policyPaths.privacyPolicy)
}

export default function PrivacyRedirect() {
  return null
}
