import { Component, type ErrorInfo, type ReactNode } from "react"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { HugeiconsIcon } from "@hugeicons/react"
import { AlertCircleIcon } from "@hugeicons/core-free-icons"
import { Button } from "~/components/ui/button"

interface Props {
  children?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 max-w-md mx-auto mt-10">
          <Alert variant="destructive">
            <HugeiconsIcon icon={AlertCircleIcon} />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>
              <p className="mb-2">{this.state.error?.message}</p>
              <Button
                variant="outline"
                onClick={() => {
                  localStorage.removeItem("sl2jp:recents:v1")
                  window.location.reload()
                }}
              >
                Clear Data & Reload
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )
    }

    return this.props.children
  }
}
