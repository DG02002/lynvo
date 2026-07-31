import type { Route } from "./+types/_site.policies.usage-policy"
import { UsagePolicyContent } from "../content/usage-policy-content"

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Usage policy | Lynvo" },
    {
      name: "description",
      content:
        "Rules for using Lynvo, Lynvo Plugin Server Extraction, Custom Plugin Servers, credentials, storage, and request allowances.",
    },
  ]
}

export default function UsagePolicy() {
  return <UsagePolicyContent />
}
