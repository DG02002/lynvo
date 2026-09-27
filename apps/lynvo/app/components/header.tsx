import { ArrowDown01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useEffect, useRef, useState } from "react"
import { useLocation, useNavigate, useRouteLoaderData } from "react-router"

import { LogoLink } from "~/components/logo"
import {
  getDocumentationSection,
  type DocumentationSectionKey,
} from "~/features/site/docs/docs-sections"
import { useViewTransition } from "~/lib/client-profile"
import { isDeveloperDocsRoutePathname, isDocsRoutePathname } from "~/lib/paths"
import { signOut } from "~/lib/session-http"
import { cn } from "~/lib/utils"

import { GuestNavActions } from "./header/guest-nav-actions"
import { LogoutDialog } from "./header/logout-dialog"
import { UserNavActions } from "./header/user-nav-actions"

const DocsSectionSwitcher = ({
  sectionKey,
}: {
  sectionKey: DocumentationSectionKey
}) => {
  const navigate = useNavigate()
  const [sectionListOpen, setSectionListOpen] = useState(false)
  const sectionSwitcherRef = useRef<HTMLButtonElement>(null)
  const sectionMenuItemRefs = useRef<Array<HTMLButtonElement | null>>([])
  const initialSectionMenuItemIndex = useRef(0)
  const restoreSectionSwitcherFocus = useRef(false)
  const currentSection = getDocumentationSection(sectionKey)
  const otherSection = getDocumentationSection(
    sectionKey === "developer" ? "user" : "developer"
  )

  useEffect(() => {
    if (sectionListOpen) {
      sectionMenuItemRefs.current[initialSectionMenuItemIndex.current]?.focus()
      initialSectionMenuItemIndex.current = 0
    } else if (restoreSectionSwitcherFocus.current) {
      sectionSwitcherRef.current?.focus()
      restoreSectionSwitcherFocus.current = false
    }
  }, [sectionListOpen])

  const closeSectionList = (restoreFocus: boolean) => {
    restoreSectionSwitcherFocus.current = restoreFocus
    setSectionListOpen(false)
  }

  return (
    <div className="relative">
      <button
        ref={sectionSwitcherRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={sectionListOpen}
        onClick={() => setSectionListOpen(true)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault()
            initialSectionMenuItemIndex.current =
              event.key === "ArrowUp" ? 1 : 0
            setSectionListOpen(true)
          }
        }}
        className={cn(
          "flex items-center gap-1 rounded-sm px-1 text-lg font-normal tracking-tight text-muted-foreground transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          sectionListOpen && "invisible"
        )}
      >
        {currentSection.shortLabel}
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
            onClick={() => closeSectionList(true)}
          />
          <div
            id="docs-section-menu"
            role="menu"
            aria-label="Documentation sections"
            className="docs-section-switcher absolute -top-[5px] -left-[5px] z-50 flex flex-col rounded-lg border border-foreground/15 bg-background p-1 shadow-lg"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault()
                closeSectionList(true)
                return
              }

              if (event.key === "Tab") {
                closeSectionList(false)
                return
              }

              const focusedIndex = sectionMenuItemRefs.current.findIndex(
                (item) =>
                  item === event.currentTarget.ownerDocument.activeElement
              )
              let nextIndex: number

              if (event.key === "ArrowDown") {
                nextIndex =
                  (focusedIndex + 1) % sectionMenuItemRefs.current.length
              } else if (event.key === "ArrowUp") {
                nextIndex =
                  (focusedIndex - 1 + sectionMenuItemRefs.current.length) %
                  sectionMenuItemRefs.current.length
              } else if (event.key === "Home") {
                nextIndex = 0
              } else if (event.key === "End") {
                nextIndex = sectionMenuItemRefs.current.length - 1
              } else {
                return
              }

              event.preventDefault()
              sectionMenuItemRefs.current[nextIndex]?.focus()
            }}
          >
            {[currentSection, otherSection].map((candidate, index) => {
              const isCurrentSection = candidate.key === currentSection.key

              return (
                <button
                  key={candidate.key}
                  ref={(element) => {
                    sectionMenuItemRefs.current[index] = element
                  }}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isCurrentSection}
                  tabIndex={-1}
                  onClick={() => {
                    closeSectionList(true)
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
                  {candidate.shortLabel}
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
  )
}

export const Header = ({ showSaveAction }: { showSaveAction: boolean }) => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const data = useRouteLoaderData<{
    user: { email: string; name?: string | null } | null
  }>("root")
  const user = data?.user
  const [remotePlayOpen, setRemotePlayOpen] = useState(false)
  const [logoutDialogOpen, setLogoutDialogOpen] = useState(false)
  const viewTransition = useViewTransition()
  const isDocsRoute = isDocsRoutePathname(pathname)
  const isDeveloperRoute = isDeveloperDocsRoutePathname(pathname)

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
              <DocsSectionSwitcher
                sectionKey={isDeveloperRoute ? "developer" : "user"}
              />
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
