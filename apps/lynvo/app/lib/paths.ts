export const authPaths = {
  signIn: "/auth/log-in",
  signInWithAnotherDevice: "/auth/sign-in-with-another-device",
  logout: "/auth/logout",
} as const

export const sitePaths = {
  about: "/about",
  androidTvSetup: "/docs/android-tv",
  changelog: "/changelog",
  docs: "/docs",
  helpCenter: "/help-center",
  plugins: "/plugins",
  pricing: "/pricing",
  settings: "/settings",
} as const

export const policyPaths = {
  cookiePolicy: "/policies/cookie-policy",
  licenses: "/policies/licenses",
  privacyPolicy: "/policies/privacy-policy",
  termsOfUse: "/policies/terms-of-use",
  usagePolicy: "/policies/usage-policy",
} as const

const saveFolderRouteSegment = "save/folder"

export const SAVE_FOLDER_PATH_SEARCH_PARAM = "path"

export const savePaths = {
  root: "/save",
  folderPrefix: `/${saveFolderRouteSegment}/`,
  folderRoute: `${saveFolderRouteSegment}/:savedLinkId`,
} as const
