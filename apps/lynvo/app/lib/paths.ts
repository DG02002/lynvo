export const authPaths = {
  signIn: "/auth/log-in",
  signInWithAnotherDevice: "/auth/sign-in-with-another-device",
  createAccount: "/auth/create-account",
  logout: "/auth/logout",
} as const

export const sitePaths = {
  about: "/about",
  androidTvSetup: "/docs/android-tv",
  changelog: "/changelog",
  docs: "/docs",
  helpCenter: "/help-center",
  pricing: "/pricing",
  settings: "/settings",
} as const

export const policyPaths = {
  cookiePolicy: "/policies/cookie-policy",
  privacyPolicy: "/policies/privacy-policy",
  termsOfUse: "/policies/terms-of-use",
  usagePolicy: "/policies/usage-policy",
} as const
