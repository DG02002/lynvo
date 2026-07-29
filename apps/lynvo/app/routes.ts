import {
  type RouteConfig,
  route,
  layout,
  index,
} from "@react-router/dev/routes"

export default [
  // Site layout wrapping the pages
  layout("features/site/routes/_site.tsx", [
    index("features/site/routes/_site._index.tsx"),
    route("save", "features/links/routes/_site.save.tsx"),
    route("ui-test-list", "features/links/routes/_site.ui-test-list.tsx"),
    route("account", "features/site/routes/_site.account.tsx"),
    route("settings", "features/site/routes/_site.settings.tsx"),
    route("privacy", "features/site/routes/_site.privacy.tsx"),
    route("terms", "features/site/routes/_site.terms.tsx"),
    route("about", "features/site/routes/_site.about.tsx"),
    route("help-center", "features/site/routes/_site.help-center.tsx"),
    route("docs/markdown/*", "features/site/routes/_site.docs-markdown.ts"),
    route("docs/*", "features/site/routes/_site.docs.tsx"),
    route("changelog", "features/site/routes/_site.changelog.tsx"),
    route("pricing", "features/site/routes/_site.pricing.tsx"),
    route(
      "policies/cookie-policy",
      "features/site/routes/_site.policies.cookie-policy.tsx"
    ),
    route(
      "policies/privacy-policy",
      "features/site/routes/_site.policies.privacy-policy.tsx"
    ),
    route(
      "policies/terms-of-use",
      "features/site/routes/_site.policies.terms-of-use.tsx"
    ),
    route(
      "policies/usage-policy",
      "features/site/routes/_site.policies.usage-policy.tsx"
    ),
    route("*", "features/site/routes/_site.not-found.tsx"),
  ]),

  layout("features/auth/routes/_auth.tsx", [
    route("auth/log-in", "features/auth/routes/_auth.log-in.tsx"),
    route(
      "auth/create-account",
      "features/auth/routes/_auth.create-account.tsx"
    ),
    route(
      "auth/reset-password/new-password",
      "features/auth/routes/_auth.new-password.tsx"
    ),
    route(
      "auth/sign-in-with-another-device",
      "features/auth/routes/_auth.sign-in-with-another-device.tsx"
    ),
    route("auth/logout", "features/auth/routes/_auth.logout.tsx"),
  ]),

  // TV Pairing
  route("tv", "features/auth/routes/_auth.tv.tsx"),

  // Devtools Configuration
  route(
    ".well-known/appspecific/com.chrome.devtools.json",
    "features/site/routes/well-known.devtools.ts"
  ),
] satisfies RouteConfig
