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

  const { sessions, loading, hasError, fetchSessions } = useRemoteSessions()

  const handleDeviceSelect = (session: RemoteSession) => {
    connectToSession(session.id, session.deviceName || "Unnamed device")
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
          <DialogTitle className="font-normal">Connect Remote Play</DialogTitle>
          <DialogDescription>
            Open Lynvo in a browser on another device. Keep Lynvo open, then
            choose that device from the list.
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
              hasError={hasError}
              activeSessionId={activeSessionId}
              onSelect={handleDeviceSelect}
              onSearchAgain={() => void fetchSessions()}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
