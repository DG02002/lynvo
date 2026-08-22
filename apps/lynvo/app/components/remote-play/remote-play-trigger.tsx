import { HugeiconsIcon } from "@hugeicons/react"
import { AirplayLineIcon } from "@hugeicons/core-free-icons"
import { Button } from "~/components/ui/button"
import { cn } from "~/lib/utils"

export const RemotePlayTrigger = ({
  activeSessionId,
  connectedDeviceName,
}: {
  activeSessionId: string | null
  connectedDeviceName: string | null
}) => (
  <Button
    variant="ghost"
    className={cn(
      "relative size-9 p-0 sm:w-auto sm:px-3 gap-2",
      activeSessionId &&
        "text-primary hover:text-primary bg-primary/10 hover:bg-primary/20",
      "data-[state=open]:text-primary data-[state=open]:bg-primary/10"
    )}
    title={
      activeSessionId
        ? `Remote Play connected to ${connectedDeviceName || "unnamed device"}`
        : "Set up or control Remote Play"
    }
  >
    <HugeiconsIcon icon={AirplayLineIcon} className="size-5" />
    <span className="hidden sm:inline font-medium">Remote Play</span>
    {activeSessionId && (
      <span className="absolute top-1 right-1 size-2 rounded-full bg-primary animate-pulse" />
    )}
  </Button>
)
