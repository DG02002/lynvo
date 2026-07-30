export const SETTINGS_TAB_VALUES = [
  "general",
  "security",
  "plugins",
  "usage",
  "storage",
  "player",
] as const

export type SettingsTab = (typeof SETTINGS_TAB_VALUES)[number]

export interface SettingsRoute {
  activeTab: SettingsTab
  showActiveSessions: boolean
}

const isSettingsTab = (value: string): value is SettingsTab =>
  SETTINGS_TAB_VALUES.some((tab) => tab === value)

export const getSettingsPath = (
  tab: SettingsTab,
  subview?: "active-sessions"
) =>
  subview === "active-sessions"
    ? "/settings/security/active-sessions"
    : `/settings/${tab}`

export const parseSettingsRoute = (
  section?: string,
  subview?: string
): SettingsRoute | null => {
  if (!section) {
    return { activeTab: "general", showActiveSessions: false }
  }
  if (!isSettingsTab(section)) {
    return null
  }
  if (!subview) {
    return { activeTab: section, showActiveSessions: false }
  }
  if (section === "security" && subview === "active-sessions") {
    return { activeTab: "security", showActiveSessions: true }
  }
  return null
}

export const getLegacySettingsPath = (hash: string) => {
  const [section, subview] = hash.replace(/^#/, "").split("/")
  const route = parseSettingsRoute(section, subview)
  if (!route || !section) {
    return null
  }
  return getSettingsPath(
    route.activeTab,
    route.showActiveSessions ? "active-sessions" : undefined
  )
}
