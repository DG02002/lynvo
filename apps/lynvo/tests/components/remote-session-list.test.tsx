import { fireEvent, render, screen } from "@testing-library/react"
import type { ComponentProps } from "react"
import { MemoryRouter } from "react-router"
import { describe, expect, it, vi } from "vitest"
import { RemoteSessionList } from "~/components/remote-play/RemoteSessionList"

const renderList = (
  overrides: Partial<ComponentProps<typeof RemoteSessionList>> = {}
) => {
  const props: ComponentProps<typeof RemoteSessionList> = {
    sessions: [],
    loading: false,
    hasError: false,
    activeSessionId: null,
    onSelect: vi.fn(),
    onSearchAgain: vi.fn(),
    ...overrides,
  }

  render(
    <MemoryRouter>
      <RemoteSessionList {...props} />
    </MemoryRouter>
  )
  return props
}

describe("RemoteSessionList", () => {
  it("announces the exact search target", () => {
    renderList({ loading: true })

    expect(screen.getByText("Searching for Remote Play devices…")).toBeVisible()
  })

  it("provides a retry action when no devices are found", () => {
    const props = renderList()

    expect(screen.getByText("No Remote Play devices found")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Search again" }))
    expect(props.onSearchAgain).toHaveBeenCalledOnce()
  })

  it("shows the empty state when only the current device is available", () => {
    renderList({
      sessions: [
        { id: "current-session", deviceName: "This device", lastActiveAt: 10 },
      ],
      activeSessionId: "current-session",
    })

    expect(screen.getByText("No Remote Play devices found")).toBeVisible()
    expect(screen.getByRole("button", { name: "Search again" })).toBeVisible()
  })

  it("distinguishes a failed device request from an empty list", () => {
    renderList({ hasError: true })

    expect(screen.getByText("Device list couldn’t be loaded")).toBeVisible()
    expect(
      screen.getByText("Check the connection, then search again.")
    ).toBeVisible()
  })

  it("labels a session without a supplied name", () => {
    renderList({
      sessions: [{ id: "session-one", deviceName: "", lastActiveAt: 10 }],
    })

    expect(screen.getByText("Unnamed device")).toBeVisible()
  })
})
