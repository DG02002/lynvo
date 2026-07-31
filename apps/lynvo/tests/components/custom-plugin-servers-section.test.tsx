import * as React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CustomPluginServersSection } from "~/features/site/settings/plugins-settings"

const CustomPluginServersHarness = ({
  onAddPluginServer,
}: {
  onAddPluginServer: (value: {
    baseUrl: string
    apiKey: string
  }) => Promise<string | null>
}) => {
  const [open, setOpen] = React.useState(false)
  return (
    <CustomPluginServersSection
      pluginServers={[]}
      requestOrigin="http://localhost:5173"
      isAddPluginServerOpen={open}
      onAddPluginServerOpenChange={setOpen}
      onAddPluginServer={onAddPluginServer}
      onDeletePluginServer={vi.fn()}
      onRefreshPluginServer={vi.fn()}
      onTogglePluginServer={vi.fn()}
    />
  )
}

describe("CustomPluginServersSection", () => {
  it("provides an action when no Plugin Servers are connected", () => {
    render(<CustomPluginServersHarness onAddPluginServer={vi.fn()} />)

    expect(
      screen.getByText("No Custom Plugin Servers are connected.")
    ).toBeVisible()
    expect(
      screen.getAllByRole("button", { name: "Add Custom Plugin Server" })
    ).toHaveLength(2)
  })

  it("validates and submits a Custom Plugin Server form", async () => {
    const onAddPluginServer = vi.fn().mockResolvedValue(null)
    render(<CustomPluginServersHarness onAddPluginServer={onAddPluginServer} />)

    fireEvent.click(
      screen.getAllByRole("button", { name: "Add Custom Plugin Server" })[0]!
    )
    fireEvent.click(
      screen.getByRole("button", { name: "Add Custom Plugin Server" })
    )

    expect(await screen.findByText("Base URL is required.")).toBeVisible()
    expect(onAddPluginServer).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText("Custom Plugin Server URL"), {
      target: { value: "https://plugin-server.example.com" },
    })
    fireEvent.change(screen.getByLabelText("Custom Plugin Server API key"), {
      target: { value: "secret" },
    })
    fireEvent.click(
      screen.getByRole("button", { name: "Add Custom Plugin Server" })
    )

    await waitFor(() => {
      expect(onAddPluginServer).toHaveBeenCalledWith({
        baseUrl: "https://plugin-server.example.com",
        apiKey: "secret",
      })
    })
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", {
          name: "Add Custom Plugin Server",
        })
      ).not.toBeInTheDocument()
    })
  })

  it("keeps a registration failure visible in the form", async () => {
    const onAddPluginServer = vi
      .fn()
      .mockResolvedValue("API key verification failed.")
    render(<CustomPluginServersHarness onAddPluginServer={onAddPluginServer} />)

    fireEvent.click(
      screen.getAllByRole("button", { name: "Add Custom Plugin Server" })[0]!
    )
    fireEvent.change(screen.getByLabelText("Custom Plugin Server URL"), {
      target: { value: "https://plugin-server.example.com" },
    })
    fireEvent.click(
      screen.getByRole("button", { name: "Add Custom Plugin Server" })
    )

    expect(
      await screen.findByText("API key verification failed.")
    ).toBeVisible()
    expect(
      screen.getByRole("heading", { name: "Add Custom Plugin Server" })
    ).toBeVisible()
  })
})
