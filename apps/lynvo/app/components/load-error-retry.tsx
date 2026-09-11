import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/spinner"
import { cn } from "~/lib/utils"

export interface LoadErrorRetryProps {
  className?: string
  message: string
  isRetrying: boolean
  onRetry: () => void
}

const LoadErrorRetry = ({
  className,
  isRetrying,
  message,
  onRetry,
}: LoadErrorRetryProps) => {
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
        onClick={onRetry}
      >
        {isRetrying && <Spinner data-icon="inline-start" aria-hidden="true" />}
        Try again
      </Button>
    </div>
  )
}

export { LoadErrorRetry }
