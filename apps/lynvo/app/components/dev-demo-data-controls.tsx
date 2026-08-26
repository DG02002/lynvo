import { useState } from "react"
import { showErrorToast, showSuccessToast } from "~/lib/toast-notifications"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/spinner"

interface DevDemoDataControlsProps {
  readonly onLoad: () => Promise<void>
}

export const DevDemoDataControls = ({ onLoad }: DevDemoDataControlsProps) => {
  const [isLoading, setIsLoading] = useState(false)

  const handleLoad = async () => {
    if (isLoading) {
      return
    }
    setIsLoading(true)
    try {
      await onLoad()
      showSuccessToast({ title: "Demo links added" })
    } catch {
      showErrorToast({ title: "Unable to add demo links. Try again." })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 px-3 py-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isLoading}
        aria-busy={isLoading}
        onClick={() => void handleLoad()}
      >
        {isLoading && <Spinner aria-hidden="true" className="size-3.5" />}
        Add demo links
      </Button>
      <p className="text-xs text-muted-foreground">
        Development only: TMDB examples for direct media, folders, containers,
        and lazy folders.
      </p>
    </div>
  )
}
