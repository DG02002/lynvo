import type { ReactNode } from "react"

import { cn } from "~/lib/utils"

import { MEDIA_LIST_HEADER_MENU_CELL_CLASS } from "./media-list-row-constants"
import { SaveListBackButton } from "./save-list-header-controls"
import {
  SAVE_LIST_IMMERSIVE_HEADER_GRID_CLASS,
  SEASON_ARTWORK_ASIDE_CLASS,
} from "./save-list-layout-constants"

interface ImmersiveBrowserHeaderProps {
  readonly onNavigateBack: () => void
  readonly title: ReactNode
  readonly center?: ReactNode
  readonly menu: ReactNode
  readonly menuCellClassName?: string
}

export const ImmersiveBrowserHeader = ({
  onNavigateBack,
  title,
  center,
  menu,
  menuCellClassName = MEDIA_LIST_HEADER_MENU_CELL_CLASS,
}: ImmersiveBrowserHeaderProps) => (
  <header className={SAVE_LIST_IMMERSIVE_HEADER_GRID_CLASS}>
    <SaveListBackButton onNavigateBack={onNavigateBack} />
    {title}
    {center}
    <div className={menuCellClassName}>{menu}</div>
  </header>
)

interface SeasonArtworkAsideProps {
  readonly as?: "aside" | "div"
  readonly className?: string
  readonly children: ReactNode
}

export const SeasonArtworkAside = ({
  as = "aside",
  className,
  children,
}: SeasonArtworkAsideProps) => {
  const asideClassName = cn(SEASON_ARTWORK_ASIDE_CLASS, className)
  return as === "div" ? (
    <div className={asideClassName}>{children}</div>
  ) : (
    <aside className={asideClassName}>{children}</aside>
  )
}
