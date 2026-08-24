import { useState } from "react"
import { isRouteErrorResponse, Link, useRevalidator } from "react-router"
import { AddPluginDomainAlertDialog } from "~/components/links/add-plugin-domain-alert-dialog"
import { LinkSelectionDialog } from "~/components/send-link/link-selection-dialog"
import { Button } from "~/components/ui/button"
import { Skeleton } from "~/components/ui/skeleton"
import { useLinkActions } from "~/hooks/use-link-actions"
import { useLinks } from "~/hooks/use-links"
import { TitleGroupDetail } from "~/features/links/components/title-group-detail"
import { useSaveListFullscreen } from "~/components/save-list/use-save-list-fullscreen"

interface SaveTitleRouteViewProps {
  readonly group: TitleGroupProjection
}

export const SaveTitleRouteView = ({ group }: SaveTitleRouteViewProps) => {
  const { links, actions } = useLinks()
  const [, setHighlightedId] = useState<string | null>(null)
  const { linkItemActions, selectionDialog, pluginDomainDialog } =
    useLinkActions({
      links,
      linkActions: actions,
      setHighlightedId,
    })

  useSaveListFullscreen(true)

  return (
    <>
      <TitleGroupDetail group={group} links={links} actions={linkItemActions} />
      <LinkSelectionDialog
        open={selectionDialog.state.open}
        onOpenChange={selectionDialog.setOpen}
        links={selectionDialog.state.links}
        onConfirm={selectionDialog.confirmSelection}
        onExpandFolder={selectionDialog.expandFolder}
        pluginIcon={selectionDialog.display.pluginIcon}
        pluginName={selectionDialog.display.pluginName}
        pageTitle={selectionDialog.display.pageTitle}
        audioInfo={selectionDialog.display.audioInfo}
      />
      <AddPluginDomainAlertDialog
        suggestion={pluginDomainDialog.suggestion}
        isAdding={pluginDomainDialog.isAdding}
        onAdd={pluginDomainDialog.add}
        onDismiss={pluginDomainDialog.dismiss}
      />
    </>
  )
}

export const SaveTitleRouteFallback = () => (
  <main className="min-h-svh bg-background px-6 py-6 md:px-10 md:py-10">
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
      <Skeleton className="h-9 w-28" />
      <div className="grid gap-6 md:grid-cols-[12rem_minmax(0,1fr)]">
        <Skeleton className="aspect-2/3" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  </main>
)

interface SaveTitleRouteErrorBoundaryProps {
  readonly error: unknown
}

export const SaveTitleRouteErrorBoundary = ({
  error,
}: SaveTitleRouteErrorBoundaryProps) => {
  const revalidator = useRevalidator()
  if (isRouteErrorResponse(error) && error.status === 404) {
    return (
      <main className="flex min-h-svh items-center justify-center px-6 py-12">
        <div className="flex max-w-md flex-col items-center gap-4 text-center">
          <h1 className="font-heading text-2xl font-medium">Title not found</h1>
          <p className="text-sm text-muted-foreground">
            This saved title is no longer available.
          </p>
          <Link
            to="/save"
            className="inline-flex min-h-11 items-center rounded-4xl bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to save
          </Link>
        </div>
      </main>
    )
  }
  const isRetrying = revalidator.state === "loading"
  return (
    <main className="flex min-h-svh items-center justify-center px-6 py-12">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <h1 className="font-heading text-2xl font-medium">
          Couldn’t load this title
        </h1>
        <p className="text-sm text-muted-foreground">
          The saved title is temporarily unavailable. Try again.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button
            type="button"
            onClick={() => revalidator.revalidate()}
            disabled={isRetrying}
          >
            {isRetrying ? "Loading…" : "Try again"}
          </Button>
          <Link
            to="/save"
            className="inline-flex min-h-11 items-center rounded-4xl border border-border px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Back to save
          </Link>
        </div>
      </div>
    </main>
  )
}
