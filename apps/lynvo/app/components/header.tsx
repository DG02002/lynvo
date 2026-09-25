import { ChevronRightIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Result, Schema } from "effect"
import { useMemo, useState, type ReactElement } from "react"
import { Link, useMatches, useNavigate, useRouteLoaderData } from "react-router"

import { LogoLink } from "~/components/logo"
import { useViewTransition } from "~/lib/client-profile"
import { signOut } from "~/lib/session-http"

import { GuestNavActions } from "./header/guest-nav-actions"
import { LogoutDialog } from "./header/logout-dialog"
import { UserNavActions } from "./header/user-nav-actions"

interface HeaderBreadcrumbItem {
  readonly label: string
  readonly to?: string
}

const headerBreadcrumbLoaderDataSchema = Schema.Struct({
  breadcrumb: Schema.NullOr(
    Schema.Array(
      Schema.Struct({
        label: Schema.String,
        to: Schema.optional(Schema.String),
      })
    )
  ),
})

// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- I/O boundary parser: input is an arbitrary route loader payload, and anti-slop/no-unknown-parameters (error) bans spelling that parameter as `unknown`.
function decodeBreadcrumbLoaderData<LoaderData>(
  loaderData: LoaderData
): readonly HeaderBreadcrumbItem[] | null | undefined {
  const decoded = Schema.decodeUnknownResult(headerBreadcrumbLoaderDataSchema)(
    loaderData
  )

  return Result.isSuccess(decoded) ? decoded.success.breadcrumb : undefined
}

const HeaderBreadcrumb = ({
  items,
}: {
  items: readonly HeaderBreadcrumbItem[]
}): ReactElement => (
  <nav
    aria-label="Breadcrumb"
    className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground"
  >
    {items.map((item, index) => {
      const isCurrentPage = index === items.length - 1

      return (
        <span key={item.label} className="flex min-w-0 items-center gap-2">
          {index > 0 && (
            <HugeiconsIcon
              icon={ChevronRightIcon}
              aria-hidden="true"
              className="size-3.5 shrink-0"
              strokeWidth={1.5}
            />
          )}
          {item.to && !isCurrentPage ? (
            <Link
              to={item.to}
              prefetch="intent"
              className="shrink-0 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {item.label}
            </Link>
          ) : (
            <span
              aria-current={isCurrentPage ? "page" : undefined}
              className={
                isCurrentPage
                  ? "truncate font-medium text-foreground"
                  : "shrink-0"
              }
            >
              {item.label}
            </span>
          )}
        </span>
      )
    })}
  </nav>
)

export const Header = ({ showSaveAction }: { showSaveAction: boolean }) => {
  const navigate = useNavigate()
  const data = useRouteLoaderData<{
    user: { email: string; name?: string | null } | null
  }>("root")
  const user = data?.user
  const [remotePlayOpen, setRemotePlayOpen] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  const viewTransition = useViewTransition()
  const matches = useMatches()
  const breadcrumb = useMemo(() => {
    let breadcrumbItems: readonly HeaderBreadcrumbItem[] | null = null

    for (const match of matches) {
      const decodedBreadcrumb = decodeBreadcrumbLoaderData(match.loaderData)
      if (decodedBreadcrumb !== undefined) {
        breadcrumbItems = decodedBreadcrumb
      }
    }

    return breadcrumbItems && breadcrumbItems.length > 0 ? (
      <HeaderBreadcrumb items={breadcrumbItems} />
    ) : null
  }, [matches])

  const handleLogout = async () => {
    try {
      await signOut()
      await navigate("/", { viewTransition })
    } catch (error) {
      console.error("Sign-out failed:", error)
    }
  }

  return (
    <header data-site-header className="fixed top-0 z-50 w-full bg-background">
      <div className="relative flex h-14 w-full items-center gap-3 px-6 md:h-16 md:px-8 lg:px-10 xl:px-14">
        <LogoLink variant="text-only" size="sm" />
        <div className="hidden min-w-0 flex-1 items-center md:flex">
          {breadcrumb}
        </div>
        <div className="min-w-0 flex-1 md:hidden" />
        <div className="flex shrink-0 items-center gap-2">
          {user ? (
            <>
              <UserNavActions
                name={user.name}
                email={user.email}
                showSaveAction={showSaveAction}
                remotePlayOpen={remotePlayOpen}
                onRemotePlayOpenChange={setRemotePlayOpen}
                onLogoutDialogOpen={() => setLogoutDialogOpen(true)}
              />
              <LogoutDialog
                open={logoutDialogOpen}
                onOpenChange={setLogoutDialogOpen}
                email={user.email}
                onLogout={() => void handleLogout()}
              />
            </>
          ) : (
            <GuestNavActions />
          )}
        </div>
      </div>
    </header>
  )
}
