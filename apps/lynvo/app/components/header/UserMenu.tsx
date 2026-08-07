import { HugeiconsIcon } from "@hugeicons/react"
import {
  AirplayLineIcon,
  Logout05Icon,
  Settings01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons"
import { Link } from "react-router"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { sitePaths } from "~/lib/paths"

export const UserMenu = ({
  username,
  onRemotePlay,
  onLogout,
}: {
  username: string
  onRemotePlay: () => void
  onLogout: () => void
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={
        <button
          type="button"
          className="flex h-9 items-center gap-2 rounded-full px-2 hover:bg-accent transition-colors outline-none sm:px-4"
        >
          <HugeiconsIcon icon={UserIcon} className="size-4" />
          <span className="hidden text-base font-normal sm:inline">
            {username}
          </span>
        </button>
      }
    />
    <DropdownMenuContent align="end" className="w-max min-w-max">
      <DropdownMenuItem
        render={
          <Link
            to="#"
            onClick={(event) => {
              event.preventDefault()
              onRemotePlay()
            }}
            className="cursor-pointer"
          >
            <HugeiconsIcon icon={AirplayLineIcon} />
            <span>Remote Play</span>
          </Link>
        }
      />
      <DropdownMenuItem
        render={
          <Link
            to={sitePaths.settings}
            viewTransition
            className="cursor-pointer"
          >
            <HugeiconsIcon icon={Settings01Icon} />
            <span>Settings</span>
          </Link>
        }
      />
      <DropdownMenuItem
        nativeButton
        render={
          <button
            type="button"
            onClick={onLogout}
            className="w-full cursor-pointer"
          >
            <HugeiconsIcon icon={Logout05Icon} />
            <span>Log out</span>
          </button>
        }
      />
    </DropdownMenuContent>
  </DropdownMenu>
)
