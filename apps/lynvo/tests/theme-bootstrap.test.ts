import { describe, expect, it, vi } from "vitest"
import { getThemeFromCookieHeader, THEME_BOOTSTRAP_SCRIPT } from "~/lib/theme"

const runThemeBootstrap = ({
  storedTheme,
  prefersDark,
}: {
  storedTheme: string | null
  prefersDark: boolean
}) => {
  const storedValues = new Map<string, string>()
  const storage = {
    getItem: (key: string) => storedValues.get(key) ?? null,
    setItem: (key: string, value: string) => storedValues.set(key, value),
  }

  document.documentElement.className = "h-full"
  document.documentElement.style.colorScheme = ""
  document.documentElement.style.backgroundColor = ""
  vi.stubGlobal("localStorage", storage)

  if (storedTheme) {
    storage.setItem("theme", storedTheme)
  }

  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: prefersDark }))

  window.eval(THEME_BOOTSTRAP_SCRIPT)
}

describe("theme bootstrap", () => {
  it("applies a stored dark theme before hydration", () => {
    runThemeBootstrap({ storedTheme: "dark", prefersDark: false })

    expect(document.documentElement).toHaveClass("dark")
    expect(document.documentElement.style.colorScheme).toBe("dark")
    expect(document.documentElement.style.backgroundColor).toBe("rgb(0, 0, 0)")
  })

  it("resolves the system preference and removes a stale dark class", () => {
    runThemeBootstrap({ storedTheme: "system", prefersDark: false })

    expect(document.documentElement).not.toHaveClass("dark")
    expect(document.documentElement.style.colorScheme).toBe("light")
    expect(document.documentElement.style.backgroundColor).toBe(
      "rgb(255, 255, 255)"
    )
  })
})

describe("theme cookie", () => {
  it("reads a valid server-rendered theme", () => {
    expect(getThemeFromCookieHeader("session=one; lynvo-theme=dark")).toBe(
      "dark"
    )
  })

  it("rejects unsupported theme values", () => {
    expect(getThemeFromCookieHeader("lynvo-theme=system")).toBeNull()
  })
})
