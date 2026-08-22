import { HugeiconsIcon } from "@hugeicons/react"
import { ComputerIcon } from "@hugeicons/core-free-icons"
import { Button } from "~/components/ui/button"

export const RemotePlayStatusCard = ({
  label,
  deviceName,
  onDisconnect,
}: {
  label: string
  deviceName: string | null
  onDisconnect: () => void | Promise<void>
}) => (
  <div className="m-4 flex items-center justify-between rounded-lg bg-primary/10 p-4 border border-primary/20">
    <div className="flex items-center gap-3">
      <HugeiconsIcon
        icon={ComputerIcon}
        className="size-5 shrink-0 text-primary"
      />
      <div>
        <p className="text-xs font-medium text-primary uppercase tracking-wide">
          {label}
        </p>
        <p className="font-semibold text-foreground">
          {deviceName || "Device name unavailable"}
        </p>
      </div>
    </div>
    <Button
      variant="ghost"
      size="sm"
      onClick={() => void onDisconnect()}
      className="text-destructive hover:text-destructive hover:bg-destructive"
    >
      Disconnect Remote Play
    </Button>
  </div>
)
