export const authPaths = {
  signIn: "/auth/log-in",
  signInWithAnotherDevice: "/auth/sign-in-with-another-device",
  createAccount: "/auth/create-account",
  logout: "/auth/logout",
} as const

export const sitePaths = {
  settings: "/settings",
} as const

export const policyPaths = {
  privacyPolicy: "/policies/privacy-policy",
  termsOfUse: "/policies/terms-of-use",
} as const
