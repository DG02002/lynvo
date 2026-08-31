import type { PluginDomainSuggestion } from "~/lib/plugin-domain"
import { ConfirmationAlertDialog } from "~/components/confirmation-alert-dialog"
import { PluginIcon } from "~/components/plugin-icon"

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
    <ConfirmationAlertDialog
      open={Boolean(suggestion)}
      onOpenChange={(open) => {
        if (!open && !isAdding) {
          onDismiss()
        }
      }}
      title="Add this domain for faster loading?"
      media={
        <PluginIcon
          iconUrl={suggestion?.pluginIconUrl}
          fallback="source"
          className="mx-auto size-16"
        />
      }
      description={
        <>
          Lynvo recognized <strong>{suggestion?.domain}</strong> as{" "}
          {suggestion?.pluginName}. Add this Plugin Domain so Lynvo can load its
          links faster next time.
        </>
      }
      confirmLabel="Add domain"
      cancelLabel="Not now"
      pending={isAdding}
      onConfirm={onAdd}
    />
  )
}
