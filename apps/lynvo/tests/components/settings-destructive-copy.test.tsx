import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DeleteAccountDialog } from "~/features/site/settings/delete-account-dialog"
import { ActiveSessionsView } from "~/features/site/settings/active-sessions-view"

describe("settings destructive actions", () => {
  it("labels the account confirmation field and states what deletion removes", () => {
    render(
      <DeleteAccountDialog
        email="darshan@example.com"
        busy={null}
        open
        confirmEmail=""
        onOpenChange={vi.fn()}
        onConfirmEmailChange={vi.fn()}
        onDeleteAccount={vi.fn()}
      />
    )

    expect(screen.getByLabelText("Type your email address to confirm")).toBeVisible()
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled()
    expect(screen.getByText("darshan@example.com")).toBeVisible()
    expect(screen.getByText(/Plugin Server connections/)).toBeVisible()
  })

  it("requests confirmation through the supplied all-session action", () => {
    const onRevokeAllSessions = vi.fn()
    render(
      <ActiveSessionsView
        sessions={[]}
        busy={null}
        onBack={vi.fn()}
        onRevokeSession={vi.fn()}
        onRevokeAllSessions={onRevokeAllSessions}
      />
    )

    fireEvent.click(screen.getByRole("button", { name: "Log out all" }))
    expect(onRevokeAllSessions).toHaveBeenCalledOnce()
    expect(screen.getByText(/including this one/)).toBeVisible()
  })

  it("revokes the selected session after the list changes", async () => {
    const onRevokeSession = vi.fn().mockResolvedValue(undefined)
    const targetSession = {
      id: "target-session",
      deviceName: "Target device",
      lastActiveAt: 2,
    }
    const { rerender } = render(
      <ActiveSessionsView
        sessions={[
          { id: "older-session", deviceName: "Older device", lastActiveAt: 3 },
          targetSession,
        ]}
        busy={null}
        onRevokeSession={onRevokeSession}
        onRevokeAllSessions={vi.fn()}
      />
    )

    fireEvent.click(screen.getAllByRole("button", { name: "Log out" })[1])
    rerender(
      <ActiveSessionsView
        sessions={[targetSession]}
        busy={null}
        onRevokeSession={onRevokeSession}
        onRevokeAllSessions={vi.fn()}
      />
    )
    fireEvent.click(screen.getByRole("button", { name: "Log out" }))

    await waitFor(() =>
      expect(onRevokeSession).toHaveBeenCalledWith("target-session")
    )
  })
})
