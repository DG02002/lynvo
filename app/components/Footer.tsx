import { Link } from "react-router"
import { policyPaths } from "~/lib/paths"

export function Footer() {
  return (
    <footer
      data-site-footer
      className="bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 py-6"
    >
      <div className="container flex flex-col items-center justify-between gap-10 md:h-12 md:flex-row md:gap-4 mx-auto px-4 md:px-8 max-w-5xl">
        <p className="text-sm text-foreground text-center md:text-left">
          Copyright © 2026 Lynvo. All rights reserved.
        </p>
        <div className="flex items-center gap-4 text-sm text-foreground mb-6 md:mb-0">
          <Link
            to={policyPaths.privacyPolicy}
            viewTransition
            className="transition-opacity hover:opacity-80"
          >
            Privacy Policy
          </Link>
          <span className="text-foreground/30">|</span>
          <Link
            to={policyPaths.termsOfUse}
            viewTransition
            className="transition-opacity hover:opacity-80"
          >
            Terms of Use
          </Link>
        </div>
      </div>
    </footer>
  )
}
