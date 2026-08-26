import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MiscellaneousSettings } from "~/features/site/settings/miscellaneous-settings"

describe("MiscellaneousSettings", () => {
  it("keeps the TV Bro setting enabled and unavailable to edit", () => {
    render(<MiscellaneousSettings />)

    const settingSwitch = screen.getByRole("switch", {
      name: "Hide the Add Link box in TV Bro",
    })

    expect(settingSwitch).toBeChecked()
    expect(settingSwitch).toHaveAttribute("aria-disabled", "true")
    expect(
      screen.queryByRole("switch", { name: "Save all links automatically" })
    ).not.toBeInTheDocument()
  })
})
