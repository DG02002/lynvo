import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
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

const getSectionShortLabel = (sectionKey: string) =>
  sectionKey === "developer" ? "Developer" : "Docs"

export const Header = ({ showSaveAction }: { showSaveAction: boolean }) => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const data = useRouteLoaderData<{
    user: { email: string; name?: string | null } | null
  }>("root")
  const user = data?.user
  const [remotePlayOpen, setRemotePlayOpen] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  // The section switcher expands in place like a native select: the closed
  // control converts into the option list, with the current option's row
  // sitting exactly where the trigger was.
  const [sectionListOpen, setSectionListOpen] = useState(false)
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
  const otherSection =
    documentationSections.find(
      (candidate) => candidate.key !== currentSection.key
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
              <div className="relative">
                <button
                  type="button"
                  aria-label="Switch documentation section"
                  aria-expanded={sectionListOpen}
                  onClick={() => setSectionListOpen(true)}
                  className={cn(
                    "flex items-center gap-1 rounded-sm px-1 text-lg font-normal tracking-tight text-muted-foreground transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                    sectionListOpen && "invisible"
                  )}
                >
                  {getSectionShortLabel(currentSection.key)}
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    aria-hidden="true"
                    className="size-4"
                    strokeWidth={2}
                  />
                </button>
                {sectionListOpen && (
                  <>
                    <div
                      aria-hidden="true"
                      className="fixed inset-0 z-40 cursor-default"
                      onClick={() => setSectionListOpen(false)}
                    />
                    <div
                      role="listbox"
                      aria-label="Documentation sections"
                      className="docs-section-switcher absolute -top-[5px] -left-[5px] z-50 flex flex-col rounded-lg border border-foreground/15 bg-background p-1 shadow-lg"
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          setSectionListOpen(false)
                        }
                      }}
                    >
                      {[currentSection, otherSection].map((candidate) => {
                        const isCurrentSection =
                          candidate.key === currentSection.key

                        return (
                          <button
                            key={candidate.key}
                            type="button"
                            role="option"
                            aria-selected={isCurrentSection}
                            onClick={() => {
                              setSectionListOpen(false)
                              if (!isCurrentSection) {
                                void navigate(candidate.root)
                              }
                            }}
                            className={cn(
                              "flex w-full items-center justify-between gap-4 rounded-sm px-1 text-lg font-normal tracking-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                              isCurrentSection
                                ? "text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {getSectionShortLabel(candidate.key)}
                            <HugeiconsIcon
                              icon={Tick02Icon}
                              aria-hidden="true"
                              className={cn(
                                "size-4 shrink-0",
                                !isCurrentSection && "invisible"
                              )}
                              strokeWidth={2}
                            />
                          </button>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
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
