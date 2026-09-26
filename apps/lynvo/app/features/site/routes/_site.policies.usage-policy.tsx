import { UsagePolicyContent } from "../content/usage-policy-content"
import type { Route } from "./+types/_site.policies.usage-policy"

export { policyFontPreloadLinks as links } from "~/components/policy-layout"

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Usage policy | Lynvo" },
    {
      name: "description",
      content:
        "Rules for links, content, Custom Plugin Servers, credentials, storage, and request allowances.",
    },
  ]
}

export default function UsagePolicy() {
  return <UsagePolicyContent />
}
