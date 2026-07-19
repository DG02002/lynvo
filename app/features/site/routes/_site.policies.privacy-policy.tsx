import type { Route } from "./+types/_site.policies.privacy-policy"
import { PrivacyPolicyContent } from "../content/privacy-policy-content"

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Privacy Policy | Lynvo" },
    {
      name: "description",
      content:
        "How Lynvo handles account data, saved links, sessions, plugins, retention, and account deletion.",
    },
  ]
}

export default function Privacy() {
  return <PrivacyPolicyContent />
}
