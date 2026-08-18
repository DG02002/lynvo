import { Link, useLocation } from "react-router"
import { policyPaths, sitePaths } from "~/lib/paths"

const supportLinks = [
  { label: "Help center", to: sitePaths.helpCenter },
] as const

const companyLinks = [
  { label: "About", to: sitePaths.about },
  { label: "Pricing", to: sitePaths.pricing },
  { label: "Plugins", to: sitePaths.plugins },
  { label: "Changelog", to: sitePaths.changelog },
] as const

const docsLinks = [
  { label: "Docs", to: sitePaths.docs },
  { label: "Set up Android TV", to: sitePaths.androidTvSetup },
  { label: "Plugin Server", to: "/docs/plugin-server" },
] as const

const policyLinks = [
  { label: "Terms of use", to: policyPaths.termsOfUse },
  { label: "Privacy policy", to: policyPaths.privacyPolicy },
  { label: "Cookie policy", to: policyPaths.cookiePolicy },
  { label: "Usage policy", to: policyPaths.usagePolicy },
  { label: "Open-source licenses", to: policyPaths.licenses },
] as const

const footerLinkClassName =
  "text-sm text-foreground transition-opacity hover:opacity-70"

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
          <Link
            to={link.to}
            prefetch="intent"
            viewTransition
            className={footerLinkClassName}
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  </nav>
)

export function Footer() {
  const { pathname } = useLocation()
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/"
  const showLinkGroups = !(
    normalizedPathname === "/save" ||
    normalizedPathname === "/settings" ||
    normalizedPathname.startsWith("/settings/") ||
    normalizedPathname.startsWith("/docs/")
  )

  return (
    <footer data-site-footer className="bg-background">
      {showLinkGroups && (
        <div className="w-full px-6 md:px-8 lg:px-10 xl:px-14">
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
              heading="Learn"
              headingId="footer-learn-heading"
              links={docsLinks}
            />
            <FooterLinkGroup
              heading="Terms and policies"
              headingId="footer-policies-heading"
              links={policyLinks}
            />
          </div>
        </div>
      )}

      <div
        className={`w-full px-6 pt-5 pb-10 md:px-8 md:pb-12 lg:px-10 xl:px-14 ${showLinkGroups ? "mt-16 md:mt-20" : "mt-8 md:mt-12"}`}
      >
        <p className="text-center text-sm text-muted-foreground">
          Lynvo © 2026
        </p>
      </div>
    </footer>
  )
}
