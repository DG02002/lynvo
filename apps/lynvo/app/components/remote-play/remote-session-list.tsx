import { HugeiconsIcon } from "@hugeicons/react"
import { ComputerIcon, Refresh03Icon } from "@hugeicons/core-free-icons"
import { Button } from "~/components/ui/button"
import { Spinner } from "~/components/ui/spinner"
import type { RemoteSession } from "./types"

export const RemoteSessionList = ({
  sessions,
  loading,
  hasError,
  activeSessionId,
  onSelect,
  onSearchAgain,
}: {
  sessions: RemoteSession[]
  loading: boolean
  hasError: boolean
  activeSessionId: string | null
  onSelect: (session: RemoteSession) => void
  onSearchAgain: () => void
}) => {
  const visibleSessions = sessions.filter(
    (session) => session.id !== activeSessionId
  )

  return (
    <div className="px-2 pb-2">
      <div className="flex flex-col gap-2">
        {loading ? (
          <div className="flex items-center gap-3 px-4 py-3">
            <Spinner aria-hidden="true" />
            <p className="text-sm text-muted-foreground">
              Searching for Remote Play devices…
            </p>
          </div>
        ) : hasError || visibleSessions.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-6 text-center">
            <p className="text-sm font-medium">
              {hasError
                ? "Device list couldn’t be loaded"
                : "No Remote Play devices found"}
            </p>
            {hasError && (
              <p className="mt-1 text-xs text-muted-foreground">
                Check the connection, then search again.
              </p>
            )}
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                size="icon"
                onClick={onSearchAgain}
                aria-label="Search again"
                title="Search again"
              >
                <HugeiconsIcon icon={Refresh03Icon} data-icon="inline-start" />
                <span className="sr-only">Search again</span>
              </Button>
            </div>
          </div>
        ) : (
          visibleSessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => onSelect(session)}
              className="flex w-full items-center gap-3 rounded-md px-4 py-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <HugeiconsIcon
                icon={ComputerIcon}
                className="size-5 shrink-0 text-foreground"
              />
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-medium leading-none truncate block">
                  {session.deviceName || "Unnamed device"}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
