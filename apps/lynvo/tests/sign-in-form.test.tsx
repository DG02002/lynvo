import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createMemoryRouter, RouterProvider } from "react-router"
import { SignInForm } from "~/components/auth/SignInForm"

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}))

describe("sign-in form", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("renders invalid credentials as a persistent form alert", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ preflightToken: "verified" }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Authentication failed" }), {
          status: 400,
        })
      )
    vi.stubGlobal("fetch", fetchMock)

    const router = createMemoryRouter([
      {
        id: "root",
        path: "/",
        loader: () => ({ convexUrl: "" }),
        element: <SignInForm />,
      },
    ])
    render(<RouterProvider router={router} />)

    fireEvent.change(await screen.findByLabelText("Username"), {
      target: { value: "admintest" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "existing-password" },
    })
    fireEvent.submit(screen.getByRole("form", { name: "Sign in form" }))

    expect(
      await screen.findByText("Invalid username or password.")
    ).toBeVisible()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
