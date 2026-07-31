import { render, waitFor } from "@testing-library/react"
import { createMemoryRouter, RouterProvider } from "react-router"
import { vi } from "vitest"
import Logout from "../app/features/auth/routes/_auth.logout"

const signOut = vi.fn(async () => undefined)

vi.mock("@convex-dev/auth/react", () => ({
  useAuthActions: () => ({ signOut }),
}))

describe("logout route", () => {
  it("revokes the Worker session before signing out of the legacy client", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }))
    const router = createMemoryRouter([
      { path: "/auth/logout", element: <Logout /> },
    ], { initialEntries: ["/auth/logout"] })
    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/session", {
        method: "DELETE",
        credentials: "same-origin",
      })
      expect(signOut).toHaveBeenCalledOnce()
    })
  })
})
