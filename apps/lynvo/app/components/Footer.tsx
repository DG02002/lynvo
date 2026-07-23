import { Link } from "react-router"
import { policyPaths, sitePaths } from "~/lib/paths"
import { OPEN_COOKIE_PREFERENCES_EVENT } from "~/lib/constants"

const productLinks = [
  { label: "Docs", to: sitePaths.docs },
  { label: "Changelog", to: sitePaths.changelog },
  { label: "Pricing", to: sitePaths.pricing },
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

export function Footer() {
  return (
    <footer data-site-footer className="border-t bg-background">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="mx-auto grid max-w-md grid-cols-2 gap-x-16 pt-16 md:pt-20">
          <nav
            aria-labelledby="footer-product-heading"
            className="flex flex-col items-center gap-5 text-center"
          >
            <h2
              id="footer-product-heading"
              className="text-sm font-normal text-muted-foreground"
            >
              Lynvo
            </h2>
            <ul className="flex flex-col items-center gap-4">
              {productLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    viewTransition
                    className={footerLinkClassName}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <button
                  type="button"
                  className={footerLinkClassName}
                  onClick={openCookiePreferences}
                >
                  Cookie Preferences
                </button>
              </li>
            </ul>
          </nav>

          <nav
            aria-labelledby="footer-policies-heading"
            className="flex flex-col items-center gap-5 text-center"
          >
            <h2
              id="footer-policies-heading"
              className="text-sm font-normal text-muted-foreground"
            >
              Policies
            </h2>
            <ul className="flex flex-col items-center gap-4">
              {policyLinks.map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    viewTransition
                    className={footerLinkClassName}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      <Link
        to="/"
        viewTransition
        aria-label="Lynvo home"
        className="mx-auto mt-16 mb-12 flex max-w-[96rem] justify-center overflow-hidden md:mt-20 md:mb-16"
      >
        <span className="block shrink-0 -translate-x-[0.025em] pb-[0.08em] text-[clamp(10rem,36vw,34rem)] leading-[0.72] font-light tracking-[-0.05em] text-foreground">
          Lynvo
        </span>
      </Link>

      <div className="border-t px-4 py-5 md:px-8">
        <p className="text-center text-sm text-muted-foreground">
          Lynvo © 2026
        </p>
      </div>
    </footer>
  )
}
