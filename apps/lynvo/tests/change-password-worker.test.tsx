import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createMemoryRouter, RouterProvider } from "react-router"
import NewPassword from "~/features/auth/routes/_auth.new-password"

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

describe("Change Password browser operation", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("changes the password through the same-origin Settings interface", async () => {
    const requests: Array<Request> = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = new Request(input, init)
        requests.push(request)
        return Response.json({ success: true })
      })
    )
    const router = createMemoryRouter(
      [
        { path: "/change", element: <NewPassword /> },
        { path: "/settings", element: <p>Settings destination</p> },
      ],
      { initialEntries: ["/change"] }
    )
    render(<RouterProvider router={router} />)

    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "CurrentPassword123!" },
    })
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "NewPasswordPhrase123!" },
    })
    fireEvent.change(screen.getByLabelText("Re-enter new password"), {
      target: { value: "NewPasswordPhrase123!" },
    })
    fireEvent.submit(screen.getByRole("form", { name: "Change password form" }))

    expect(await screen.findByText("Settings destination")).toBeVisible()
    await waitFor(() => expect(requests).toHaveLength(1))
    expect(new URL(requests[0].url).pathname).toBe(
      "/api/settings/security/password"
    )
    expect(requests[0].method).toBe("PATCH")
    await expect(requests[0].json()).resolves.toEqual({
      currentPassword: "CurrentPassword123!",
      newPassword: "NewPasswordPhrase123!",
    })
  })
})
