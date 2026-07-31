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
  it("does not render an empty-state message when no plugin servers are configured", () => {
    render(<CustomPluginServersHarness onAddPluginServer={vi.fn()} />)

    expect(
      screen.queryByText("No custom plugin servers configured.")
    ).not.toBeInTheDocument()
  })

  it("validates and submits a Custom Plugin Server form", async () => {
    const onAddPluginServer = vi.fn().mockResolvedValue(null)
    render(<CustomPluginServersHarness onAddPluginServer={onAddPluginServer} />)

    fireEvent.click(screen.getByRole("button", { name: "Add plugin server" }))
    fireEvent.click(screen.getByRole("button", { name: "Add plugin server" }))

    expect(await screen.findByText("Base URL is required.")).toBeVisible()
    expect(onAddPluginServer).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText("Plugin server URL"), {
      target: { value: "https://plugin-server.example.com" },
    })
    fireEvent.change(screen.getByLabelText("Plugin server API key"), {
      target: { value: "secret" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add plugin server" }))

    await waitFor(() => {
      expect(onAddPluginServer).toHaveBeenCalledWith({
        baseUrl: "https://plugin-server.example.com",
        apiKey: "secret",
      })
    })
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", {
          name: "Add plugin server",
        })
      ).not.toBeInTheDocument()
    })
  })

  it("keeps a registration failure visible in the form", async () => {
    const onAddPluginServer = vi
      .fn()
      .mockResolvedValue("API key verification failed.")
    render(<CustomPluginServersHarness onAddPluginServer={onAddPluginServer} />)

    fireEvent.click(screen.getByRole("button", { name: "Add plugin server" }))
    fireEvent.change(screen.getByLabelText("Plugin server URL"), {
      target: { value: "https://plugin-server.example.com" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add plugin server" }))

    expect(
      await screen.findByText("API key verification failed.")
    ).toBeVisible()
    expect(
      screen.getByRole("heading", { name: "Add plugin server" })
    ).toBeVisible()
  })
})
