import {
  AbacusIcon,
  AtomIcon,
  CalculatorIcon,
  ChessKnightIcon,
  ConeIcon,
  CubeIcon,
  DicesIcon,
  DiceIcon,
  DnaIcon,
  DivideSignIcon,
  Gamepad01Icon,
  HexagonIcon,
  InfinityIcon,
  JoystickIcon,
  MicroscopeIcon,
  MoleculesIcon,
  PentagonIcon,
  PiIcon,
  PuzzleIcon,
  RhombusIcon,
  Rocket01Icon,
  RubiksCubeIcon,
  SigmaIcon,
  TelescopeIcon,
  TriangleIcon,
  TrophyIcon,
  HelpSquareIcon,
  type ThreeDViewIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { getPluginIconSource, type PluginIconSource } from "~/lib/plugin-icons"
import { cn } from "~/lib/utils"

interface PluginIconProps {
  icon?: PluginIconSource
  iconUrl?: string
  className?: string
}

export const PluginIcon = ({ icon, iconUrl, className }: PluginIconProps) => {
  const resolvedIcon = icon ?? getPluginIconSource(iconUrl)
  if (resolvedIcon?.hugeIcon) {
    return (
      <HugeiconsIcon
        icon={resolvedIcon.hugeIcon}
        className={cn("shrink-0", className)}
        aria-hidden="true"
      />
    )
  }

  if (resolvedIcon?.url) {
    const isMonochrome = resolvedIcon.url.includes("direct-media")
    return (
      <img
        src={resolvedIcon.url}
        alt=""
        className={cn(
          "shrink-0 object-contain",
          isMonochrome && "dark:invert",
          className
        )}
        loading="lazy"
      />
    )
  }

  return (
    <HugeiconsIcon
      icon={HelpSquareIcon}
      className={cn("shrink-0 text-foreground", className)}
      aria-hidden="true"
      data-icon-fallback="source"
    />
  )
}

// Plugin Servers do not declare icons. Each registered server gets a stable
// decorative avatar instead: a stroke icon from the shapes, games, mathematics,
// and science packs on an aurora gradient that keeps the white glyph legible.
const PLUGIN_SERVER_AVATAR_ICONS = [
  CubeIcon,
  HexagonIcon,
  PentagonIcon,
  RhombusIcon,
  TriangleIcon,
  ConeIcon,
  DiceIcon,
  DicesIcon,
  PuzzleIcon,
  ChessKnightIcon,
  TrophyIcon,
  Gamepad01Icon,
  JoystickIcon,
  RubiksCubeIcon,
  SigmaIcon,
  CalculatorIcon,
  InfinityIcon,
  AbacusIcon,
  PiIcon,
  DivideSignIcon,
  AtomIcon,
  MoleculesIcon,
  DnaIcon,
  TelescopeIcon,
  Rocket01Icon,
  MicroscopeIcon,
] as const satisfies readonly (typeof ThreeDViewIcon)[]

const PLUGIN_SERVER_AVATAR_GRADIENTS = [
  "from-violet-500 to-purple-700",
  "from-sky-500 to-blue-700",
  "from-emerald-500 to-teal-700",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-700",
  "from-fuchsia-500 to-purple-800",
  "from-cyan-500 to-sky-700",
  "from-indigo-500 to-violet-800",
] as const

const hashPluginServerId = (serverId: string): number => {
  let hash = 0x811c9dc5
  for (let index = 0; index < serverId.length; index += 1) {
    hash ^= serverId.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

interface PluginServerAvatarProps {
  readonly serverId: string
  readonly name: string
  readonly className?: string
}

export const PluginServerAvatar = ({
  serverId,
  name,
  className,
}: PluginServerAvatarProps) => {
  const hash = hashPluginServerId(serverId)
  const icon =
    PLUGIN_SERVER_AVATAR_ICONS[hash % PLUGIN_SERVER_AVATAR_ICONS.length]
  const gradient =
    PLUGIN_SERVER_AVATAR_GRADIENTS[
      (hash >>> 8) % PLUGIN_SERVER_AVATAR_GRADIENTS.length
    ]
  return (
    <span
      role="img"
      aria-label={name}
      data-plugin-server-avatar={serverId}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white",
        gradient,
        className
      )}
    >
      <HugeiconsIcon icon={icon} className="size-[55%]" aria-hidden="true" />
    </span>
  )
}
