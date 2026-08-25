import type { Route } from "./+types/_site.policies.licenses"
import { LicensesContent } from "../content/licenses-content"

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Open-source licenses | Lynvo" },
    {
      name: "description",
      content:
        "Lynvo software licenses, TMDB attribution, and third-party content notices.",
    },
  ]
}

export default function Licenses() {
  return <LicensesContent />
}
