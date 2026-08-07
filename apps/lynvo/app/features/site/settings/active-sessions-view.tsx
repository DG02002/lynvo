import { useState } from "react"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { SmartPhone02Icon } from "@hugeicons/core-free-icons"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
import { ConfirmationAlertDialog } from "~/components/confirmation-alert-dialog"
import { SettingsList, SettingsRow } from "./settings-layout"

const LaptopMinimalIcon = [
  [
    "rect",
    {
      width: "18",
      height: "12",
      x: "3",
      y: "4",
      rx: "2",
      stroke: "currentColor",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: "1.5",
      key: "0",
    },
  ],
  [
    "path",
    {
      d: "M2 20h20",
      stroke: "currentColor",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      strokeWidth: "1.5",
      key: "1",
    },
  ],
] as const satisfies IconSvgElement

export interface UserSession {
  id: string
  deviceName: string
  lastActiveAt: number
  isCurrent?: boolean
}

interface ActiveSessionsViewProps {
  sessions: readonly UserSession[]
  busy: string | null
  onRevokeSession: (sessionIndex: number) => Promise<void>
  onRevokeAllSessions: () => void
}

const getSessionClientName = (deviceName: string) =>
  deviceName.toLowerCase().includes("android")
    ? "Lynvo on Android"
    : "Lynvo Web"

const getSessionDeviceName = (deviceName: string) =>
  deviceName.trim() || "Unnamed device"

const formatSessionDate = (lastActiveAt: number) =>
  new Date(lastActiveAt)
    .toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
    .replace(",", " at")

const orderSessions = (sessions: readonly UserSession[]) =>
  sessions
    .map((session, sessionIndex) => ({ session, sessionIndex }))
    .sort(
      (left, right) =>
        Number(Boolean(right.session.isCurrent)) -
          Number(Boolean(left.session.isCurrent)) ||
        right.session.lastActiveAt - left.session.lastActiveAt
    )

export const ActiveSessionsView = ({
  sessions,
  busy,
  onRevokeSession,
  onRevokeAllSessions,
}: ActiveSessionsViewProps) => {
  const [sessionToRevoke, setSessionToRevoke] = useState<{
    sessionIndex: number
    deviceName: string
  } | null>(null)
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false)
  const [isRevoking, setIsRevoking] = useState(false)

  const handleConfirmRevoke = async () => {
    if (!sessionToRevoke) {
      return
    }

    setIsRevoking(true)
    try {
      await onRevokeSession(sessionToRevoke.sessionIndex)
      setRevokeDialogOpen(false)
    } catch {
      // The caller presents the operation error; keep the dialog open to retry.
    } finally {
      setIsRevoking(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 py-4">
      <SettingsList className="divide-y-0 border-y-0">
        {orderSessions(sessions).map(({ session, sessionIndex }) => {
          const isMobile = /iphone|ipad|android|pixel|phone/i.test(
            session.deviceName
          )
          const DeviceIcon = isMobile ? SmartPhone02Icon : LaptopMinimalIcon
          const clientName = getSessionClientName(session.deviceName)

          return (
            <SettingsRow key={session.id} className="gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <HugeiconsIcon
                  icon={DeviceIcon}
                  className="mt-1 size-6 shrink-0 text-foreground"
                />
                <div className="min-w-0 flex flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm truncate">
                      {getSessionDeviceName(session.deviceName)}
                    </span>
                    {session.isCurrent && (
                      <Badge
                        variant="secondary"
                        className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-foreground"
                      >
                        Current session
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {clientName}
                  </span>
                  <span className="text-xs text-muted-foreground/80">
                    {formatSessionDate(session.lastActiveAt)}
                  </span>
                </div>
              </div>
              {!session.isCurrent && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 rounded-full border-muted-foreground/30 bg-transparent px-4 text-sm font-medium hover:bg-transparent"
                  onClick={() => {
                    setSessionToRevoke({
                      sessionIndex,
                      deviceName: getSessionDeviceName(session.deviceName),
                    })
                    setRevokeDialogOpen(true)
                  }}
                >
                  Log out
                </Button>
              )}
            </SettingsRow>
          )
        })}
      </SettingsList>

      <div className="mt-6 flex flex-col gap-4 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1 pr-4">
          <h3 className="font-normal text-foreground text-sm">
            Log out of all sessions
          </h3>
          <p className="text-sm text-muted-foreground leading-snug">
            End every active session, including this one. Session termination
            may take up to 30 minutes.
          </p>
        </div>
        <Button
          variant="outline"
          className="rounded-full border-destructive bg-transparent text-destructive hover:bg-transparent hover:text-destructive px-5 shrink-0 self-start sm:self-center"
          onClick={onRevokeAllSessions}
          disabled={busy === "revokeAll"}
        >
          {busy === "revokeAll" ? "Logging out…" : "Log out all"}
        </Button>
      </div>

      <ConfirmationAlertDialog
        open={revokeDialogOpen}
        onOpenChange={(open) => {
          if (!isRevoking) {
            setRevokeDialogOpen(open)
          }
        }}
        title="Log out this session?"
        description={
          <>
            This logs <strong>{sessionToRevoke?.deviceName}</strong> out of
            Lynvo.
          </>
        }
        confirmLabel={isRevoking ? "Logging out…" : "Log out"}
        confirmVariant="destructive"
        disabled={isRevoking}
        onConfirm={() => void handleConfirmRevoke()}
      />
    </div>
  )
}
