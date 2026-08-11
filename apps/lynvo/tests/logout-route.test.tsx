import { render, waitFor } from "@testing-library/react"
import { createMemoryRouter, RouterProvider } from "react-router"
import { vi } from "vitest"
import Logout from "../app/features/auth/routes/_auth.logout"

describe("logout route", () => {
  it("revokes the Worker session", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }))
    const router = createMemoryRouter(
      [{ path: "/auth/logout", element: <Logout /> }],
      { initialEntries: ["/auth/logout"] }
    )
    render(<RouterProvider router={router} />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/session", {
        method: "DELETE",
        credentials: "same-origin",
      })
    })
  })

  it("binds authenticated logout to the rendered session", async () => {
    document.head.innerHTML =
      '<meta name="lynvo-user-id" content="user-a"><meta name="lynvo-session-id" content="session-a">'
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 204 }))
    const router = createMemoryRouter(
      [{ path: "/auth/logout", element: <Logout /> }],
      { initialEntries: ["/auth/logout"] }
    )
    render(<RouterProvider router={router} />)

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/auth/session", {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          "X-Lynvo-Expected-User-Id": "user-a",
          "X-Lynvo-Expected-Session-Id": "session-a",
        },
      })
    )
    document.head.innerHTML = ""
  })
})
