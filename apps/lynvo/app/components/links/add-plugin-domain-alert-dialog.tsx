import type { PluginDomainSuggestion } from "~/lib/plugin-domain"
import { PluginIcon } from "~/components/plugin-icon"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { Spinner } from "~/components/ui/spinner"

interface AddPluginDomainAlertDialogProps {
  suggestion: PluginDomainSuggestion | null
  isAdding: boolean
  onAdd: () => void
  onDismiss: () => void
}

export function AddPluginDomainAlertDialog({
  suggestion,
  isAdding,
  onAdd,
  onDismiss,
}: AddPluginDomainAlertDialogProps) {
  return (
    <AlertDialog
      open={Boolean(suggestion)}
      onOpenChange={(open) => {
        if (!open && !isAdding) {
          onDismiss()
        }
      }}
    >
      <AlertDialogContent className="p-10">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-muted">
          <PluginIcon iconUrl={suggestion?.pluginIconUrl} fallback="source" />
        </div>
        <AlertDialogHeader className="w-full place-items-center gap-4 text-center sm:place-items-center sm:text-center">
          <AlertDialogTitle className="w-full px-0 text-center text-2xl font-normal leading-tight sm:px-10 sm:text-3xl">
            Add this domain for faster loading?
          </AlertDialogTitle>
          <AlertDialogDescription className="w-full text-center text-base text-muted-foreground">
            Lynvo recognized <strong>{suggestion?.domain}</strong> as{" "}
            {suggestion?.pluginName}. Add this Plugin Domain so Lynvo can load
            its links faster next time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="mt-4 flex w-full flex-col gap-3">
          <AlertDialogAction
            className="h-12 w-full rounded-full text-sm"
            disabled={isAdding}
            onClick={onAdd}
          >
            {isAdding ? (
              <>
                <Spinner aria-hidden="true" />
                Adding…
              </>
            ) : (
              "Add domain"
            )}
          </AlertDialogAction>
          <AlertDialogCancel
            variant="outline"
            className="h-12 w-full rounded-full border-muted-foreground/20 text-sm"
            disabled={isAdding}
          >
            Not now
          </AlertDialogCancel>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
