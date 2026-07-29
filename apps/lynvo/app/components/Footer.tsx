import { Link } from "react-router"
import { policyPaths, sitePaths } from "~/lib/paths"
import { OPEN_COOKIE_PREFERENCES_EVENT } from "~/lib/constants"

const supportLinks = [
  { label: "Help Center", to: sitePaths.helpCenter },
] as const

const companyLinks = [
  { label: "About Us", to: sitePaths.about },
  { label: "Pricing", to: sitePaths.pricing },
  { label: "Changelog", to: sitePaths.changelog },
] as const

const docsLinks = [
  { label: "Docs", to: sitePaths.docs },
  { label: "Android TV Setup", to: sitePaths.androidTvSetup },
  { label: "External Extractor", to: "/docs/extractor" },
] as const

const policyLinks = [
  { label: "Terms of Use", to: policyPaths.termsOfUse },
  { label: "Privacy Policy", to: policyPaths.privacyPolicy },
  { label: "Cookie Policy", to: policyPaths.cookiePolicy },
  { label: "Usage Policy", to: policyPaths.usagePolicy },
] as const

const footerLinkClassName =
  "text-sm text-foreground transition-opacity hover:opacity-70"

const openCookiePreferences = () =>
  window.dispatchEvent(new Event(OPEN_COOKIE_PREFERENCES_EVENT))

const FooterLinkGroup = ({
  heading,
  headingId,
  links,
}: {
  heading: string
  headingId: string
  links: readonly { label: string; to: string }[]
}) => (
  <nav aria-labelledby={headingId} className="flex flex-col items-start gap-5">
    <h2 id={headingId} className="text-sm font-normal text-muted-foreground">
      {heading}
    </h2>
    <ul className="flex flex-col items-start gap-4">
      {links.map((link) => (
        <li key={link.to}>
          <Link to={link.to} viewTransition className={footerLinkClassName}>
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  </nav>
)

export function Footer() {
  return (
    <footer data-site-footer className="bg-background">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="grid grid-cols-2 gap-x-8 gap-y-12 pt-16 sm:grid-cols-4 md:pt-20">
          <FooterLinkGroup
            heading="Support"
            headingId="footer-support-heading"
            links={supportLinks}
          />
          <FooterLinkGroup
            heading="Company"
            headingId="footer-company-heading"
            links={companyLinks}
          />
          <FooterLinkGroup
            heading="Docs"
            headingId="footer-docs-heading"
            links={docsLinks}
          />
          <FooterLinkGroup
            heading="Terms & Policies"
            headingId="footer-policies-heading"
            links={policyLinks}
          />
        </div>
      </div>

      <div className="mt-16 px-4 pt-5 pb-10 md:mt-20 md:px-8 md:pb-12">
        <p className="flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
          <span>Lynvo © 2026</span>
          <button
            type="button"
            className="underline underline-offset-4 hover:text-foreground"
            onClick={openCookiePreferences}
          >
            Manage Cookies
          </button>
        </p>
      </div>
    </footer>
  )
}
