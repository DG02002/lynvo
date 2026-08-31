import { render, screen } from "@testing-library/react"

import { LogoutDialog } from "../app/components/header/logout-dialog"

describe("LogoutDialog", () => {
  it("presents logout as a destructive action", () => {
    const rendered = render(
      <LogoutDialog
        open
        onOpenChange={() => undefined}
        email="user@example.com"
        onLogout={() => undefined}
      />
    )

    expect(screen.getByRole("button", { name: "Log out" })).toHaveClass(
      "text-destructive"
    )
    expect(rendered.baseElement.querySelector("svg")).toHaveClass(
      "text-destructive"
    )
  })
})
