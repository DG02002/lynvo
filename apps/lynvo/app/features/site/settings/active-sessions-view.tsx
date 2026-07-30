import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { ArrowLeft01Icon, SmartPhone02Icon } from "@hugeicons/core-free-icons"
import { toast } from "sonner"
import { Badge } from "~/components/ui/badge"
import { Button } from "~/components/ui/button"
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
  sessions: UserSession[]
  busy: string | null
  onBack: () => void
  onRevokeSession: (sessionIndex: number) => Promise<void>
  onRevokeAllSessions: () => Promise<void>
}

const getSessionClientName = (deviceName: string, isMobile: boolean) => {
  const lowerDeviceName = deviceName.toLowerCase()
  if (!isMobile) {
    return "Lynvo Web"
  }
  return lowerDeviceName.includes("android")
    ? "Lynvo Android App"
    : "Lynvo iOS App"
}

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

export const ActiveSessionsView = ({
  sessions,
  busy,
  onBack,
  onRevokeSession,
  onRevokeAllSessions,
}: ActiveSessionsViewProps) => (
  <div className="flex flex-col gap-6 py-4">
    <div className="flex items-center gap-3 border-b pb-4">
      <Button
        variant="ghost"
        size="icon"
        className="-ml-2 h-9 w-9"
        onClick={onBack}
        aria-label="Back to Security and login"
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" />
      </Button>
      <h2 className="text-2xl font-normal tracking-tight">Active sessions</h2>
    </div>

    <p className="text-sm text-muted-foreground leading-relaxed">
      Review recent sessions and trusted devices associated with your account.
      Trusted devices can receive security prompts, like approving sign-ins or
      unlocking your account.
    </p>

    <SettingsList>
      {sessions.map((session, sessionIndex) => {
        const isMobile = /iphone|ipad|android|pixel|phone/i.test(
          session.deviceName
        )
        const DeviceIcon = isMobile ? SmartPhone02Icon : LaptopMinimalIcon
        const clientName = getSessionClientName(session.deviceName, isMobile)

        return (
          <SettingsRow key={session.id} className="items-start gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="mt-1 shrink-0 p-1.5 bg-muted/30 rounded-lg">
                <HugeiconsIcon
                  icon={DeviceIcon}
                  className="size-6 text-foreground"
                />
              </div>
              <div className="min-w-0 flex flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-sm truncate">
                    {session.deviceName}
                  </span>
                  {session.isCurrent && (
                    <Badge
                      variant="secondary"
                      className="uppercase text-[9px] font-semibold tracking-wider px-2 py-0.5 bg-muted text-foreground rounded-full"
                    >
                      Current Session
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
                className="rounded-full px-4 text-sm font-medium border-muted-foreground/30 hover:bg-muted/10 h-9 shrink-0"
                onClick={async () => {
                  await onRevokeSession(sessionIndex)
                  toast.success("Logged out device session")
                }}
              >
                Log out
              </Button>
            )}
          </SettingsRow>
        )
      })}
    </SettingsList>

    <div className="border-t pt-6 mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div className="flex flex-col gap-1 pr-4">
        <h3 className="font-normal text-foreground text-sm">
          Log out of all sessions
        </h3>
        <p className="text-sm text-muted-foreground leading-snug">
          Log out of all active sessions across all devices, including your
          current session. This may take up to 30 minutes.
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
  </div>
)
