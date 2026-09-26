import { CookiePolicyContent } from "../content/cookie-policy-content"
import type { Route } from "./+types/_site.policies.cookie-policy"

export { policyFontPreloadLinks as links } from "~/components/policy-layout"

export const meta = (_: Route.MetaArgs) => [
  { title: "Cookie policy | Lynvo" },
  {
    name: "description",
    content:
      "How Lynvo uses cookies and browser storage for sign-in, security, appearance, player defaults, and connected devices.",
  },
]

const CookiePolicy = () => <CookiePolicyContent />

export default CookiePolicy
