import type { Route } from "./+types/_site.policies.privacy-policy"
import { PrivacyPolicyContent } from "../content/privacy-policy-content"

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Privacy policy | Lynvo" },
    {
      name: "description",
      content:
        "How Lynvo collects, uses, shares, and deletes account data, saved links, sessions, and Plugin information.",
    },
  ]
}

export default function Privacy() {
  return <PrivacyPolicyContent />
}
