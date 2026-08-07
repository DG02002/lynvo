import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DeleteAccountDialog } from "~/features/site/settings/delete-account-dialog"
import { ActiveSessionsView } from "~/features/site/settings/active-sessions-view"

describe("settings destructive actions", () => {
  it("labels the account confirmation field and states what deletion removes", () => {
    render(
      <DeleteAccountDialog
        username="darshan"
        busy={null}
        open
        confirmUsername=""
        onOpenChange={vi.fn()}
        onConfirmUsernameChange={vi.fn()}
        onDeleteAccount={vi.fn()}
      />
    )

    expect(screen.getByLabelText("Type username to confirm")).toBeVisible()
    expect(screen.getByText("darshan")).toBeVisible()
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
})
