import type { PlayerDefinition } from "~/lib/player-utils"
import { cn } from "~/lib/utils"

interface PlayerOptionProps {
  player: PlayerDefinition
  className?: string
}

export const PlayerOption = ({ player, className }: PlayerOptionProps) => (
  <>
    <img
      src={player.iconUrl}
      alt=""
      className={cn("size-5 shrink-0 rounded-sm object-cover", className)}
    />
    {player.name}
  </>
)
