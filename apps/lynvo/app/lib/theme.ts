export const THEME_STORAGE_KEY = "theme"
export const THEME_COOKIE_NAME = "lynvo-theme"
export const THEME_COOKIE_MAX_AGE_SECONDS = 31_536_000

export const THEME_BOOTSTRAP_SCRIPT = `(()=>{try{const storedTheme=localStorage.getItem("${THEME_STORAGE_KEY}");const resolvedTheme=storedTheme==="dark"||storedTheme==="light"?storedTheme:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";const root=document.documentElement;root.classList.toggle("dark",resolvedTheme==="dark");root.style.colorScheme=resolvedTheme;root.style.backgroundColor=resolvedTheme==="dark"?"#000":"#fff";document.cookie="${THEME_COOKIE_NAME}="+resolvedTheme+"; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax";addEventListener("DOMContentLoaded",()=>root.style.removeProperty("background-color"),{once:true})}catch{}})()`

export const getThemeFromCookieHeader = (cookieHeader: string | null) => {
  const themeCookie = cookieHeader
    ?.split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${THEME_COOKIE_NAME}=`))
  const theme = themeCookie?.slice(THEME_COOKIE_NAME.length + 1)

  return theme === "dark" || theme === "light" ? theme : null
}
