import {
  Activity03Icon,
  Add01Icon,
  AirplayLineIcon,
  AlertCircleIcon,
  ApiIcon,
  CheckmarkCircle02Icon,
  FileEmpty01Icon,
  Globe02Icon,
  GridViewIcon,
  HardDriveIcon,
  Key01Icon,
  Link01Icon,
  Link02Icon,
  ModernTvIcon,
  PackageIcon,
  PlayIcon,
  Plug02Icon,
  PlugSocketIcon,
  Rocket01Icon,
  Settings01Icon,
  SourceCodeSquareIcon,
  StarsIcon,
  TerminalIcon,
  Tick02Icon,
  UserCircleIcon,
  UserIcon,
  Video02Icon,
} from "@hugeicons/core-free-icons"
import type { IconSvgElement } from "@hugeicons/react"

/**
 * Sidebar and home-card icons reuse icons that already appear elsewhere in
 * Lynvo. Do not introduce a new icon here without using it in the app first.
 */
const pageIconsBySlug = new Map<string, IconSvgElement>([
  // User documentation
  ["start-guide", Rocket01Icon],
  ["concepts", Link01Icon],
  ["sign-in", UserIcon],
  ["android-tv", ModernTvIcon],
  ["saving-links", Add01Icon],
  ["library-views", GridViewIcon],
  ["opening-links", Video02Icon],
  ["remote-play", AirplayLineIcon],
  ["general", Settings01Icon],
  ["account", UserCircleIcon],
  ["security", Key01Icon],
  ["plugins", Plug02Icon],
  ["proxy-keys", Globe02Icon],
  ["usage", Activity03Icon],
  ["storage", HardDriveIcon],
  ["player", PlayIcon],

  // Developer documentation
  ["what-is-a-plugin-server", PlugSocketIcon],
  ["what-is-a-plugin", Plug02Icon],
  ["prerequisites", TerminalIcon],
  ["create-plugin-server", Rocket01Icon],
  ["protocol-overview", ApiIcon],
  ["authentication", Key01Icon],
  ["manifest", FileEmpty01Icon],
  ["hono-routes", SourceCodeSquareIcon],
  ["extraction-requests", Link02Icon],
  ["media-nodes", Video02Icon],
  ["success-responses", CheckmarkCircle02Icon],
  ["usage-limits", Activity03Icon],
  ["errors", AlertCircleIcon],
  ["testing", Tick02Icon],
  ["deployment", PackageIcon],
  ["connect", Add01Icon],
  ["agent-prompt", StarsIcon],
])

export const assertDocumentationPageIcons = (slugs: readonly string[]) => {
  const pageSlugs = new Set(slugs)
  const missingSlugs = [...pageSlugs].filter(
    (slug) => !pageIconsBySlug.has(slug)
  )
  const staleSlugs = [...pageIconsBySlug.keys()].filter(
    (slug) => !pageSlugs.has(slug)
  )

  if (missingSlugs.length > 0 || staleSlugs.length > 0) {
    throw new Error(
      [
        missingSlugs.length > 0
          ? `Documentation pages are missing icons: ${missingSlugs.join(", ")}`
          : undefined,
        staleSlugs.length > 0
          ? `Documentation icons have no page: ${staleSlugs.join(", ")}`
          : undefined,
      ]
        .filter((message) => message !== undefined)
        .join(". ")
    )
  }
}

export const getDocumentationPageIcon = (slug: string): IconSvgElement => {
  const icon = pageIconsBySlug.get(slug)
  if (!icon) {
    throw new Error(`Documentation page icon is missing: ${slug}`)
  }
  return icon
}
