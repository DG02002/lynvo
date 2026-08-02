import type { Route } from "./+types/_site.policies.privacy-policy"
import { PrivacyPolicyContent } from "../content/privacy-policy-content"

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Privacy policy | Lynvo" },
    {
      name: "description",
      content:
        "How Lynvo handles account data, saved links, sessions, Plugins, retention, and account deletion.",
    },
  ]
}

export default function Privacy() {
  return <PrivacyPolicyContent />
}
