import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { MiscellaneousSettings } from "~/features/site/settings/miscellaneous-settings"

describe("MiscellaneousSettings", () => {
  it("keeps both required settings enabled and unavailable to edit", () => {
    render(<MiscellaneousSettings />)

    const switches = screen.getAllByRole("switch")

    expect(switches).toHaveLength(2)
    for (const settingSwitch of switches) {
      expect(settingSwitch).toBeChecked()
      expect(settingSwitch).toHaveAttribute("aria-disabled", "true")
    }
  })
})
