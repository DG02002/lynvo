import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog"
import { useRemoteControl } from "~/context/RemoteControlContext"
import { RemotePlayStatusCard } from "./remote-play/RemotePlayStatusCard"
import { RemotePlayTrigger } from "./remote-play/RemotePlayTrigger"
import { RemoteSessionList } from "./remote-play/RemoteSessionList"
import type { RemoteSession } from "./remote-play/types"
import { useRemoteSessions } from "./remote-play/use-remote-sessions"

export function RemotePlayButton({
  trigger,
  open: externalOpen,
  onOpenChange: setExternalOpen,
}: {
  trigger?: React.ReactElement | null
  open?: boolean
  onOpenChange?: (open: boolean) => void
} = {}) {
  const {
    activeSessionId,
    connectToSession,
    disconnect,
    connectedDeviceName,
    controlledBy,
    controllingDeviceName,
    handleReceiverDisconnect,
  } = useRemoteControl()
  const [internalOpen, setInternalOpen] = useState(false)
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen =
    setExternalOpen !== undefined ? setExternalOpen : setInternalOpen

  const { sessions, loading, fetchSessions } = useRemoteSessions()

  const handleDeviceSelect = (session: RemoteSession) => {
    connectToSession(session.id, session.device_name || "Unknown Device")
    setOpen(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      void fetchSessions()
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger !== null && (
        <DialogTrigger
          nativeButton={trigger ? false : undefined}
          render={
            trigger || (
              <RemotePlayTrigger
                activeSessionId={activeSessionId}
                connectedDeviceName={connectedDeviceName}
              />
            )
          }
        />
      )}
      <DialogContent className="sm:max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2 text-left">
          <DialogTitle className="font-normal">Choose a device</DialogTitle>
          <DialogDescription>
            Open <strong>TV Bro</strong> on the TV to use remote play. Play.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col p-2">
          {controlledBy ? (
            <RemotePlayStatusCard
              label="Controlled by"
              deviceName={controllingDeviceName}
              onDisconnect={handleReceiverDisconnect}
            />
          ) : activeSessionId ? (
            <RemotePlayStatusCard
              label="Connected to"
              deviceName={connectedDeviceName}
              onDisconnect={disconnect}
            />
          ) : null}

          {!controlledBy && !activeSessionId && (
            <RemoteSessionList
              sessions={sessions}
              loading={loading}
              activeSessionId={activeSessionId}
              onSelect={handleDeviceSelect}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
