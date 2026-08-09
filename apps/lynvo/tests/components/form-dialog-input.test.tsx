import { render, screen } from "@testing-library/react"
import { expect, it } from "vitest"
import { FormDialogInput } from "~/components/form-dialog-input"

it("matches floating labels to the shared dialog surface", () => {
  render(<FormDialogInput label="Field label" />)

  expect(screen.getByText("Field label")).toHaveClass("bg-popover")
})
