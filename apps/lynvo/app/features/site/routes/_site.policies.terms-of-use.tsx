import type { Route } from "./+types/_site.policies.terms-of-use"
import { TermsOfUseContent } from "../content/terms-of-use-content"

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Terms of Use | Lynvo" },
    {
      name: "description",
      content:
        "The rules for using Lynvo accounts, saved links, Plugins, Custom Plugin Servers, remote play, and Android players.",
    },
  ]
}

export default function Terms() {
  return <TermsOfUseContent />
}
