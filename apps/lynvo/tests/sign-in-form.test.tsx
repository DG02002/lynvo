import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { createMemoryRouter, RouterProvider } from "react-router"
import { SignInForm } from "~/components/auth/SignInForm"
import { SignupForm } from "~/components/auth/SignupForm"

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

  it("renders stable Turnstile actions for each authentication flow", async () => {
    const signInRouter = createMemoryRouter([
      {
        id: "root",
        path: "/",
        loader: () => ({ convexUrl: "" }),
        element: <SignInForm />,
      },
    ])
    const renderedSignIn = render(<RouterProvider router={signInRouter} />)

    expect(
      await screen.findByText(
        "Enter the username and password for the account."
      )
    ).toBeVisible()
    expect(screen.getByText("Turnstile bypassed in dev mode")).toHaveAttribute(
      "data-turnstile-action",
      "lynvo-sign-in"
    )
    renderedSignIn.unmount()

    const signUpRouter = createMemoryRouter([
      {
        id: "root",
        path: "/",
        loader: () => ({ convexUrl: "" }),
        element: <SignupForm />,
      },
    ])
    render(<RouterProvider router={signUpRouter} />)

    expect(
      await screen.findByText("Choose a username and password.")
    ).toBeVisible()
    expect(screen.getByText("Turnstile bypassed in dev mode")).toHaveAttribute(
      "data-turnstile-action",
      "lynvo-sign-up"
    )
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
        new Response(
          JSON.stringify({
            code: "invalid_credentials",
            error:
              "The username or password is incorrect. Check both fields, then try again.",
          }),
          { status: 401 }
        )
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
    fireEvent.submit(screen.getByRole("form", { name: "Log in form" }))

    expect(
      await screen.findByText(
        "The username or password is incorrect. Check both fields, then try again."
      )
    ).toBeVisible()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("does not present a server failure as invalid credentials", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ preflightToken: "verified" }), {
          status: 200,
        })
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            code: "service_unavailable",
            error: "Login is temporarily unavailable. Try again later.",
          }),
          { status: 503 }
        )
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
    fireEvent.submit(screen.getByRole("form", { name: "Log in form" }))

    expect(
      await screen.findByText(
        "Login is temporarily unavailable. Try again later."
      )
    ).toBeVisible()
    expect(
      screen.queryByText(
        "The username or password is incorrect. Check both fields, then try again."
      )
    ).not.toBeInTheDocument()
  })
})
