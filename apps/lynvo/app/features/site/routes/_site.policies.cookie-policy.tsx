import type { Route } from "./+types/_site.policies.cookie-policy"
import { CookiePolicyContent } from "../content/cookie-policy-content"

export const meta = (_: Route.MetaArgs) => [
  { title: "Cookie Policy | Lynvo" },
  {
    name: "description",
    content:
      "How Lynvo uses cookies and similar browser storage for authentication, security, preferences, analytics, and marketing.",
  },
]

const CookiePolicy = () => <CookiePolicyContent />

export default CookiePolicy
