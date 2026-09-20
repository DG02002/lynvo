import { AirplayLineIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useRef } from "react"

import { Button } from "~/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog"
import { useRemoteControl } from "~/context/remote-control-context"

export const ReceiverOverlay = () => {
  const { controllingDevices, handleReceiverDisconnect } = useRemoteControl()
  const disconnectButtonRef = useRef<HTMLButtonElement>(null)
  const isOpen = controllingDevices.length > 0

  return (
    <Dialog open={isOpen} onOpenChange={() => undefined}>
      <DialogContent
        data-receiver-overlay="true"
        initialFocus={disconnectButtonRef}
        finalFocus={true}
        showCloseButton={false}
        className="fixed inset-0 flex h-svh w-screen max-w-none translate-x-0 translate-y-0 flex-col items-center justify-center rounded-none bg-background/95 p-6 opacity-100 shadow-none ring-0 backdrop-blur-sm transition-opacity duration-300 starting:opacity-0"
      >
        <div className="max-w-md w-full flex flex-col gap-6 rounded-xl border bg-card p-8 shadow-2xl">
          <div className="flex items-center gap-4">
            <div className="shrink-0 rounded-full bg-primary/10 p-3">
              <HugeiconsIcon
                icon={AirplayLineIcon}
                className="size-6 text-primary"
              />
            </div>
            <DialogTitle className="text-xl font-semibold tracking-tight">
              Connected to a controlling device
            </DialogTitle>
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

          <div className="h-px w-full bg-border" />

          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Links sent from the controlling device open in this device’s
              Android player.
            </p>
            <Button
              ref={disconnectButtonRef}
              variant="destructive"
              className="w-full"
              onClick={handleReceiverDisconnect}
            >
              Disconnect
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
