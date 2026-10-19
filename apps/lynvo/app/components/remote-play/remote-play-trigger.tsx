import { AirplayLineIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "~/components/ui/button"

export const RemotePlayTrigger = ({
  activeSessionId,
  connectedDeviceName,
}: {
  activeSessionId: string | null
  connectedDeviceName: string | null
}) => {
  const label = activeSessionId
    ? `Remote Play connected to ${connectedDeviceName || "Unnamed device"}`
    : "Set up or control Remote Play"

  return (
    <Button
      variant={activeSessionId ? "tonal" : "ghost"}
      size="adaptive"
      aria-label={label}
      className="relative"
      title={label}
    >
      <HugeiconsIcon icon={AirplayLineIcon} className="size-5" />
      <span className="hidden font-medium sm:inline">Remote Play</span>
      {activeSessionId && (
        <span className="absolute top-1 right-1 size-2 rounded-full bg-primary animate-pulse" />
      )}
    </Button>
  )
}
