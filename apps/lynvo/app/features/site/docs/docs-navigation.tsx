import { Menu02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "react-router"

import { Button } from "~/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu"
import { cn } from "~/lib/utils"

const DocsNavigationGroups = ({
  context,
  mobile,
}: {
  context: DocumentationPageContext
  mobile: boolean
}) =>
  context.groups.map((group) => (
    <div key={group.group} className="flex flex-col gap-1">
      {(context.groups.length > 1 || mobile) && (
        <p className="mb-1 px-3 text-xs font-medium text-muted-foreground">
          {group.group}
        </p>
      )}
      {group.pages.map((page) => (
        <Link
          key={page.slug}
          to={page.url}
          aria-current={page.slug === context.page.slug ? "page" : undefined}
          className={cn(
            "w-fit max-w-full rounded-lg px-3 py-2 text-[0.8125rem] font-medium text-foreground transition-[color,background-color,scale] duration-150 active:scale-[0.96]",
            page.slug === context.page.slug
              ? "bg-muted text-foreground"
              : "hover:bg-muted/60"
          )}
        >
          {page.navLabel}
        </Link>
      ))}
    </div>
  ))

export const DocsMobileNavigation = ({
  context,
}: {
  context: DocumentationPageContext
}) => (
  <nav aria-label="Documentation" className="mb-6 lg:hidden">
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="max-w-full"
          />
        }
      >
        <HugeiconsIcon
          icon={Menu02Icon}
          strokeWidth={2}
          data-icon="inline-start"
        />
        <span className="truncate">{context.page.navLabel}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="max-h-[70svh] w-72 overflow-y-auto"
      >
        {context.groups.map((group) => (
          <DropdownMenuGroup key={group.group}>
            <DropdownMenuLabel>{group.group}</DropdownMenuLabel>
            {group.pages.map((page) => (
              <DropdownMenuItem
                key={page.slug}
                render={
                  <Link
                    to={page.url}
                    aria-current={
                      page.slug === context.page.slug ? "page" : undefined
                    }
                    className="cursor-pointer"
                  >
                    {page.navLabel}
                  </Link>
                }
              />
            ))}
          </DropdownMenuGroup>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  </nav>
)

export const DocsDesktopNavigation = ({
  context,
}: {
  context: DocumentationPageContext
}) => (
  <aside className="sticky top-16 hidden self-start lg:block">
    <div className="pointer-events-none absolute top-0 right-0 bottom-0 w-px bg-border" />
    <nav
      aria-label="Documentation"
      className="max-h-[calc(100svh-4rem)] overflow-y-auto overscroll-contain py-12 pr-8 [scrollbar-width:none]"
    >
      <Link
        to="/docs"
        className="mb-7 block w-fit max-w-full rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted/60"
      >
        Docs home
      </Link>
      <div className="flex flex-col gap-7">
        <DocsNavigationGroups context={context} mobile={false} />
      </div>
    </nav>
  </aside>
)
