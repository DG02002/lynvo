import {
  defaultCookiePreferences,
  loadCookiePreferences,
  saveCookiePreferences,
} from "~/lib/cookie-preferences"
import {
  COOKIE_PREFERENCES_STORAGE_KEY,
  COOKIE_PREFERENCES_VERSION,
} from "~/lib/constants"

const storedValues = new Map<string, string>()
const storage = {
  clear: () => storedValues.clear(),
  getItem: (key: string) => storedValues.get(key) ?? null,
  removeItem: (key: string) => storedValues.delete(key),
  setItem: (key: string, value: string) => storedValues.set(key, value),
}

Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: storage,
})

describe("cookie preferences", () => {
  beforeEach(() => {
    localStorage.clear()
    vi.restoreAllMocks()
  })

  it("returns null when no choice has been saved", () => {
    expect(loadCookiePreferences()).toBeNull()
  })

  it("saves and reloads a valid choice", () => {
    const preferences = {
      ...defaultCookiePreferences,
      analytics: true,
    }

    expect(saveCookiePreferences(preferences)).toBe(true)
    expect(loadCookiePreferences()).toEqual(preferences)
  })

  it("ignores malformed and outdated choices", () => {
    localStorage.setItem(COOKIE_PREFERENCES_STORAGE_KEY, "{invalid")
    expect(loadCookiePreferences()).toBeNull()

    localStorage.setItem(
      COOKIE_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        ...defaultCookiePreferences,
        version: COOKIE_PREFERENCES_VERSION + 1,
      })
    )
    expect(loadCookiePreferences()).toBeNull()
  })

  it("does not throw when browser storage is unavailable", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("Storage is unavailable")
    })

    expect(saveCookiePreferences(defaultCookiePreferences)).toBe(false)
  })
})
