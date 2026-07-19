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
      <div className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
        <HugeiconsIcon icon={ComputerIcon} className="size-5" />
      </div>
      <div>
        <p className="text-xs font-medium text-primary uppercase tracking-wide">
          {label}
        </p>
        <p className="font-semibold text-foreground">{deviceName}</p>
      </div>
    </div>
    <Button
      variant="ghost"
      size="sm"
      onClick={() => void onDisconnect()}
      className="text-destructive hover:text-destructive hover:bg-destructive"
    >
      Disconnect
    </Button>
  </div>
)
