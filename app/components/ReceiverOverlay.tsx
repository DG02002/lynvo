import { HugeiconsIcon } from "@hugeicons/react"
import { AirplayLineIcon } from "@hugeicons/core-free-icons"
import { Button } from "~/components/ui/button"
import { useRemoteControl } from "~/context/RemoteControlContext"

export function ReceiverOverlay() {
  const { controllingDevices, handleReceiverDisconnect } = useRemoteControl()

  if (!controllingDevices || controllingDevices.length === 0) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="max-w-md w-full flex flex-col gap-6 bg-card p-8 rounded-xl border shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-full bg-primary/ shrink-0">
            <HugeiconsIcon
              icon={AirplayLineIcon}
              className="size-6 text-primary"
            />
          </div>
          <h2 className="text-xl font-semibold tracking-tight">
            Connected to Remote Device
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
            Use your connected device to control playback and manage content.
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
