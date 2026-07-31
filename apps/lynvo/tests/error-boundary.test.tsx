import { render, screen } from "@testing-library/react"
import { ErrorBoundary } from "../app/root/error-boundary"

describe("root error boundary", () => {
  it("renders recovery navigation", () => {
    render(<ErrorBoundary error={new Error("failed")} />)
    expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute(
      "href",
      "/"
    )
    expect(
      screen.getByRole("button", { name: "Try again" })
    ).toBeInTheDocument()
  })
})
