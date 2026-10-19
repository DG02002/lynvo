import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { FormDialogContent } from "~/components/form-dialog-content"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Dialog } from "~/components/ui/dialog"

describe("FormDialogContent", () => {
  it("shows its error slot and disables submit and cancel while pending", () => {
    const onCancel = vi.fn()
    render(
      <Dialog open>
        <FormDialogContent
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
        </FormDialogContent>
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
