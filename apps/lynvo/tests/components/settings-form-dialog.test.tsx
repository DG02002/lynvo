import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { Alert, AlertDescription } from "~/components/ui/alert"
import { Dialog } from "~/components/ui/dialog"
import { SettingsFormDialogShell } from "~/features/site/settings/settings-form-dialog"

describe("SettingsFormDialogShell", () => {
  it("shows its error slot and disables submit and cancel while pending", () => {
    const onCancel = vi.fn()
    render(
      <Dialog open>
        <SettingsFormDialogShell
          title="Save settings"
          description="Update the settings."
          submitLabel="Save"
          submitPending
          submitDisabled
          cancelDisabled
          onCancel={onCancel}
          onSubmit={(event) => event.preventDefault()}
          error={
            <Alert variant="destructive">
              <AlertDescription>Could not save settings.</AlertDescription>
            </Alert>
          }
        >
          <label>
            Setting
            <input />
          </label>
        </SettingsFormDialogShell>
      </Dialog>
    )

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not save settings."
    )
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled()
    const cancel = screen.getByRole("button", { name: "Cancel" })
    expect(cancel).toBeDisabled()
    fireEvent.click(cancel)
    expect(onCancel).not.toHaveBeenCalled()
  })
})
