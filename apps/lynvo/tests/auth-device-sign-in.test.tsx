import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { expect, it, vi } from "vitest"

vi.mock("~/components/auth/device-login-qr", () => ({
  DeviceLoginQr: () => <div>QR code</div>,
}))

import SignInWithAnotherDevice from "~/features/auth/routes/_auth.sign-in-with-another-device"

it("renders the back link without native button warnings", () => {
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})

  render(
    <MemoryRouter>
      <SignInWithAnotherDevice />
    </MemoryRouter>
  )

  expect(
    screen.getByRole("button", { name: "Back to log in" })
  ).toHaveAttribute("href", "/auth/log-in")
  expect(consoleError).not.toHaveBeenCalledWith(
    expect.stringContaining("expected a native <button>")
  )

  consoleError.mockRestore()
})
