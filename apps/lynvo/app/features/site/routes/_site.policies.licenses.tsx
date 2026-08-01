import type { Route } from "./+types/_site.policies.licenses"
import { LicensesContent } from "../content/licenses-content"

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Open-source licenses | Lynvo" },
    {
      name: "description",
      content:
        "Licenses for the Lynvo core project and independently licensed Plugin Server packages.",
    },
  ]
}

export default function Licenses() {
  return <LicensesContent />
}
