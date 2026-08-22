import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { ErrorBoundary } from "../app/root/error-boundary"

describe("root error boundary", () => {
  it("describes unexpected failures honestly and offers useful recovery", () => {
    render(
      <MemoryRouter>
        <ErrorBoundary error={new Error("failed")} />
      </MemoryRouter>
    )
    expect(
      screen.getByRole("heading", { name: "Something went off course." })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("link", { name: "Report a problem" })
    ).toHaveAttribute("href", "https://github.com/DG02002/lynvo/issues")
  })

  it("keeps missing-page recovery distinct from application failures", () => {
    render(
      <MemoryRouter>
        <ErrorBoundary
          error={{
            status: 404,
            statusText: "Not Found",
            data: null,
            internal: false,
          }}
        />
      </MemoryRouter>
    )
    expect(
      screen.getByRole("heading", {
        name: "The page you’re looking for can’t be found.",
      })
    ).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Take me home" })).toHaveAttribute(
      "href",
      "/"
    )
  })
})
