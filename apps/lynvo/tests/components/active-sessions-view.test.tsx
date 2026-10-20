import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ActiveSessionsView } from "~/features/site/settings/active-sessions-view"

const getSessionIconSvg = (deviceName: string) =>
  screen
    .getByText(deviceName)
    .closest("div")
    ?.parentElement?.parentElement?.querySelector("svg")

describe("ActiveSessionsView", () => {
  it("marks Android TV sessions with a TV icon, not a phone", () => {
    render(
      <ActiveSessionsView
        sessions={[
          {
            id: "tv",
            deviceName: "TV Bro on Android TV",
            lastActiveAt: 1,
          },
          {
            id: "phone",
            deviceName: "Pixel 8",
            lastActiveAt: 2,
            isCurrent: true,
          },
          {
            id: "laptop",
            deviceName: "Chrome on macOS",
            lastActiveAt: 3,
          },
        ]}
        busy={null}
        onRevokeSession={vi.fn().mockResolvedValue(undefined)}
        onRevokeAllSessions={vi.fn()}
      />
    )

    const tvIcon = getSessionIconSvg("TV Bro on Android TV")
    const phoneIcon = getSessionIconSvg("Pixel 8")
    const laptopIcon = getSessionIconSvg("Chrome on macOS")

    expect(tvIcon?.innerHTML).toBeTruthy()
    expect(tvIcon?.innerHTML).not.toBe(phoneIcon?.innerHTML)
    expect(phoneIcon?.innerHTML).not.toBe(laptopIcon?.innerHTML)
    expect(
      screen.getByText("Lynvo on Android", { exact: false })
    ).toBeInTheDocument()
  })
})
