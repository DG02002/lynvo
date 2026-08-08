import type { Route } from "./+types/_site.policies.terms-of-use"
import { TermsOfUseContent } from "../content/terms-of-use-content"

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Terms of use | Lynvo" },
    {
      name: "description",
      content:
        "Rules for using Lynvo accounts, saved links, Plugins, Custom Plugin Servers, Remote Play, and supported Android players.",
    },
  ]
}

export default function Terms() {
  return <TermsOfUseContent />
}
