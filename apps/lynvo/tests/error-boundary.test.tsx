import { render, screen } from "@testing-library/react"
import { ErrorBoundary } from "../app/root/error-boundary"

describe("root error boundary", () => {
  it("describes unexpected failures honestly and offers useful recovery", () => {
    render(<ErrorBoundary error={new Error("failed")} />)
    expect(
      screen.getByRole("heading", { name: "Something went off course" })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/The problem is likely on our side/)
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Try again" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Report a problem" })
    ).toHaveAttribute("href", "https://github.com/DG02002/lynvo/issues")
    expect(
      screen.queryByText("Try loading the page again.")
    ).not.toBeInTheDocument()
  })

  it("keeps missing-page recovery distinct from application failures", () => {
    render(
      <ErrorBoundary
        error={{
          status: 404,
          statusText: "Not Found",
          data: null,
          internal: false,
        }}
      />
    )
    expect(
      screen.getByRole("heading", { name: "Page not found" })
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute(
      "href",
      "/"
    )
    expect(
      screen.getByRole("link", { name: "Open Help Center" })
    ).toHaveAttribute("href", "/help-center")
  })
})
