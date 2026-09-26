import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState } from "react"
import { useLocation, useNavigate, useRouteLoaderData } from "react-router"

import { LogoLink } from "~/components/logo"
import { documentationSections } from "~/features/site/docs/docs-sections"
import { useViewTransition } from "~/lib/client-profile"
import { isDocsRoutePathname, sitePaths } from "~/lib/paths"
import { signOut } from "~/lib/session-http"
import { cn } from "~/lib/utils"

import { GuestNavActions } from "./header/guest-nav-actions"
import { LogoutDialog } from "./header/logout-dialog"
import { UserNavActions } from "./header/user-nav-actions"

export const Header = ({ showSaveAction }: { showSaveAction: boolean }) => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const data = useRouteLoaderData<{
    user: { email: string; name?: string | null } | null
  }>("root")
  const user = data?.user
  const [remotePlayOpen, setRemotePlayOpen] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false)
  const viewTransition = useViewTransition()
  const isDocsRoute = isDocsRoutePathname(pathname)
  const developerRoot = sitePaths.developerDocs
  const isDeveloperRoute =
    pathname === developerRoot || pathname.startsWith(`${developerRoot}/`)
  const currentSection =
    documentationSections.find((candidate) =>
      isDeveloperRoute
        ? candidate.key === "developer"
        : candidate.key === "user"
    ) ?? documentationSections[0]

  const handleLogout = async () => {
    try {
      await signOut()
      await navigate("/", { viewTransition })
    } catch (error) {
      console.error("Sign-out failed:", error)
    }
  }

  const navigationActions = (
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
  )

  return (
    <header
      data-site-header
      className={`fixed top-0 z-50 w-full bg-background ${isDocsRoute ? "border-b border-border" : ""}`}
    >
      <div
        className={
          isDocsRoute
            ? "flex h-14 w-full items-center md:h-16"
            : "relative flex h-14 w-full items-center gap-3 px-6 md:h-16 md:px-8 lg:px-10 xl:px-14"
        }
      >
        <div
          className={
            isDocsRoute
              ? "flex h-full shrink-0 items-center gap-2 border-r border-border px-6 md:px-8 lg:w-72 lg:gap-3 lg:px-5 xl:w-80 xl:px-6"
              : "flex shrink-0 items-center"
          }
        >
          <LogoLink
            variant="text-only"
            size="sm"
            className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          />
          {isDocsRoute && (
            <>
              <span aria-hidden="true" className="h-5 w-0.5 bg-foreground/25" />
              <DialogPrimitive.Root
                open={sectionMenuOpen}
                onOpenChange={setSectionMenuOpen}
              >
                <DialogPrimitive.Trigger
                  render={
                    <button
                      type="button"
                      aria-label="Switch documentation section"
                      className="flex items-center gap-1 rounded-sm text-lg font-normal tracking-tight text-muted-foreground transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    />
                  }
                >
                  {currentSection.key === "developer" ? "Developer" : "Docs"}
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    aria-hidden="true"
                    className="size-4"
                    strokeWidth={2}
                  />
                </DialogPrimitive.Trigger>
                <DialogPrimitive.Portal>
                  <DialogPrimitive.Backdrop className="fixed inset-0 isolate z-50 bg-background/70 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-open:duration-200 data-closed:animate-out data-closed:fade-out-0 data-closed:duration-200 motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none" />
                  <DialogPrimitive.Popup className="fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-open:duration-200 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:duration-200 motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none">
                    <DialogPrimitive.Title className="sr-only">
                      Switch documentation section
                    </DialogPrimitive.Title>
                    <div className="w-80 rounded-xl border border-foreground/20 bg-background p-2 shadow-2xl">
                      {documentationSections.map((candidate) => {
                        const isCurrentSection =
                          candidate.key === currentSection.key

                        return (
                          <button
                            key={candidate.key}
                            type="button"
                            onClick={() => {
                              setSectionMenuOpen(false)
                              if (!isCurrentSection) {
                                void navigate(candidate.root)
                              }
                            }}
                            className={cn(
                              "flex w-full flex-col gap-1 rounded-lg px-4 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                              isCurrentSection
                                ? "bg-muted"
                                : "hover:bg-muted/60"
                            )}
                          >
                            <span
                              className={cn(
                                "text-base tracking-tight text-foreground",
                                isCurrentSection ? "font-medium" : "font-normal"
                              )}
                            >
                              {candidate.label}
                            </span>
                            <span className="text-sm leading-5 text-muted-foreground">
                              {candidate.homeDescription}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </DialogPrimitive.Popup>
                </DialogPrimitive.Portal>
              </DialogPrimitive.Root>
            </>
          )}
        </div>

        {isDocsRoute ? (
          <div className="min-w-0 flex-1">
            <div className="mx-auto flex h-full w-full max-w-[80rem] items-center justify-end px-6 md:px-8 xl:px-10">
              {navigationActions}
            </div>
          </div>
        ) : (
          <>
            <div className="min-w-0 flex-1" />
            {navigationActions}
          </>
        )}
      </div>
    </header>
  )
}
