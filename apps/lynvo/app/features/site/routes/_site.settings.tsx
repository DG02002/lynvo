import { HugeiconsIcon } from "@hugeicons/react"
import {
  Activity03Icon,
  HardDriveIcon,
  Key01Icon,
  PlayIcon,
  Plug02Icon,
  RepairIcon,
  Settings01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons"
import {
  NavLink,
  Outlet,
  useLoaderData,
  type LoaderFunctionArgs,
} from "react-router"
import {
  getUserSession,
  responseWithSession,
  requireUserOrRedirect,
} from "~/lib/auth"
import { getServerEnv } from "~/lib/env.server"
import { cn } from "~/lib/utils"

export function meta() {
  return [{ title: "Settings | Lynvo" }]
}

export async function loader({ request, context }: LoaderFunctionArgs) {
  const sessionResult = await getUserSession(request, getServerEnv(context))
  requireUserOrRedirect(sessionResult, new URL(request.url).pathname)
  const user = sessionResult.user!
  return responseWithSession({
    responseData: {
      user: {
        id: user.sub,
        email: user.email,
        name: user.name,
        sid: user.sid,
      },
    },
    sessionResult,
    request,
  })
}

export interface SettingsOutletContext {
  readonly user: {
    readonly id: string
    readonly email: string
    readonly name?: string | null
    readonly sid: string
  }
}

const settingsTabs = [
  { value: "general", label: "General", icon: Settings01Icon },
  { value: "account", label: "Account", icon: UserCircleIcon },
  { value: "security", label: "Security and login", icon: Key01Icon },
  { value: "plugins", label: "Plugins", icon: Plug02Icon },
  { value: "usage", label: "Usage", icon: Activity03Icon },
  { value: "storage", label: "Storage", icon: HardDriveIcon },
  { value: "player", label: "Player", icon: PlayIcon },
  { value: "miscellaneous", label: "Miscellaneous", icon: RepairIcon },
] as const

const SettingsNavigation = ({ mobile = false }: { mobile?: boolean }) => (
  <nav
    aria-label="Settings sections"
    className={cn(
      "gap-1 bg-transparent",
      mobile
        ? "flex min-w-max flex-row gap-1.5"
        : "flex w-full flex-col items-stretch"
    )}
  >
    {settingsTabs.map((item) => (
      <NavLink
        key={item.value}
        to={`/settings/${item.value}`}
        prefetch="intent"
        className={({ isActive }) =>
          cn(
            "flex items-center text-foreground hover:text-foreground dark:text-foreground dark:hover:text-foreground",
            mobile
              ? "h-10 rounded-xl px-4 gap-2 text-sm"
              : "h-11 justify-start rounded-2xl px-4 gap-2.5 text-base",
            isActive && "bg-muted"
          )
        }
      >
        <HugeiconsIcon
          icon={item.icon}
          data-icon="inline-start"
          className={mobile ? "size-5" : "size-6"}
        />
        {item.label}
      </NavLink>
    ))}
  </nav>
)

export default function SettingsLayout() {
  const { user } = useLoaderData<typeof loader>()
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-6 md:px-8 md:py-10">
      <div className="mb-6 text-center md:mb-10">
        <h1 className="py-4 text-4xl font-normal tracking-tight text-balance md:py-6 md:text-6xl">
          Settings
        </h1>
      </div>
      <div className="bg-background md:flex md:flex-row md:gap-0">
        <aside className="hidden w-64 shrink-0 border-r pr-4 md:flex md:flex-col">
          <SettingsNavigation />
        </aside>
        <div className="border-b py-4 md:hidden">
          <div className="overflow-x-auto pb-1">
            <SettingsNavigation mobile />
          </div>
        </div>
        <div className="min-w-0 flex-1 py-2 sm:px-4 md:px-8 md:py-0">
          <Outlet context={{ user } satisfies SettingsOutletContext} />
        </div>
      </div>
    </div>
  )
}
