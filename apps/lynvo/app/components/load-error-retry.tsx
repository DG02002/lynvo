import * as React from "react"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/spinner"
import { cn } from "~/lib/utils"

export interface LoadErrorRetryProps {
  className?: string
  message: string
  /** May reject; failures render through the caller's error state. */
  onRetry: () => Promise<void>
}

const LoadErrorRetry = ({
  className,
  message,
  onRetry,
}: LoadErrorRetryProps) => {
  const [isRetrying, setIsRetrying] = React.useState(false)

  const handleRetry = async () => {
    setIsRetrying(true)
    try {
      await onRetry()
    } catch {
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <div className={cn("flex flex-col items-start gap-2", className)}>
      <p className="text-sm text-destructive" role="alert">
        {message}
      </p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={isRetrying}
        onClick={() => void handleRetry()}
      >
        {isRetrying && <Spinner data-icon="inline-start" aria-hidden="true" />}
        Try again
      </Button>
    </div>
  )
}

export { LoadErrorRetry }
