import { useEffect } from "react"
import { useTheme } from "next-themes"
import { THEME_COOKIE_MAX_AGE_SECONDS, THEME_COOKIE_NAME } from "~/lib/theme"

export const ThemeCookieSync = () => {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    if (resolvedTheme !== "dark" && resolvedTheme !== "light") {
      return
    }

    document.cookie = `${THEME_COOKIE_NAME}=${resolvedTheme}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`
  }, [resolvedTheme])

  return null
}
