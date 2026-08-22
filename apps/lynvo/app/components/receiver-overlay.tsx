import { HugeiconsIcon } from "@hugeicons/react"
import { AirplayLineIcon } from "@hugeicons/core-free-icons"
import { Button } from "~/components/ui/button"
import { useRemoteControl } from "~/context/remote-control-context"

export const ReceiverOverlay = () => {
  const { controllingDevices, handleReceiverDisconnect } = useRemoteControl()

  if (!controllingDevices || controllingDevices.length === 0) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 p-6 opacity-100 backdrop-blur-sm transition-opacity duration-300 starting:opacity-0">
      <div className="max-w-md w-full flex flex-col gap-6 bg-card p-8 rounded-xl border shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-full bg-primary/ shrink-0">
            <HugeiconsIcon
              icon={AirplayLineIcon}
              className="size-6 text-primary"
            />
          </div>
          <h2 className="text-xl font-semibold tracking-tight">
            Connected to remote device
          </h2>
        </div>

        <div className="flex flex-col gap-4">
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
            Controlled by
          </p>
          <div className="flex flex-wrap gap-2">
            {controllingDevices.map((device) => (
              <span
                key={device.id}
                className="inline-flex items-center rounded-full bg-primary px-6 py-2 text-lg font-bold text-primary ring-1 ring-inset ring-blue-700/10"
              >
                {device.name}
              </span>
            ))}
          </div>
        </div>

        <div className="w-full h-px bg-border" />

        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            Links sent from the controlling device open in this device’s Android
            player.
          </p>
          <Button
            variant="destructive"
            className="w-full"
            onClick={handleReceiverDisconnect}
          >
            Disconnect
          </Button>
        </div>
      </div>
    </div>
  )
}
