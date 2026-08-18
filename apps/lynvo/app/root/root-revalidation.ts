export interface RootRevalidationInput {
  readonly currentUrl: URL
  readonly nextUrl: URL
  readonly defaultShouldRevalidate: boolean
  readonly formMethod?: string
  readonly formAction?: string
}

const ROOT_OWNED_STATE_ACTIONS = [
  "/api/auth/sign-in",
  "/api/auth/session",
  "/api/settings/security/account",
  "/api/settings/security/password",
  "/api/settings/security/sessions",
] as const

const changesRootOwnedState = (formAction: string): boolean => {
  const pathname = new URL(formAction, "https://lynvo.invalid").pathname
  return ROOT_OWNED_STATE_ACTIONS.some(
    (actionPath) =>
      pathname === actionPath || pathname.startsWith(`${actionPath}/`)
  )
}

export const shouldRevalidateRoot = ({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
  formMethod,
  formAction,
}: RootRevalidationInput): boolean => {
  if (formMethod && formMethod.toUpperCase() !== "GET") {
    return formAction ? changesRootOwnedState(formAction) : false
  }
  if (
    currentUrl.pathname === nextUrl.pathname &&
    currentUrl.search === nextUrl.search
  ) {
    return defaultShouldRevalidate
  }
  return false
}
