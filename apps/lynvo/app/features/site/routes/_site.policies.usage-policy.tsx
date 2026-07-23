import type { Route } from "./+types/_site.policies.usage-policy"
import { UsagePolicyContent } from "../content/usage-policy-content"

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Usage Policies | Lynvo" },
    {
      name: "description",
      content:
        "Rules for responsible use of Lynvo, official extraction, external extractors, credentials, and shared capacity.",
    },
  ]
}

export default function UsagePolicy() {
  return <UsagePolicyContent />
}
