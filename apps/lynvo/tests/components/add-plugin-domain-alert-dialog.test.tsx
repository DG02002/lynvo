import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AddPluginDomainAlertDialog } from "~/components/links/add-plugin-domain-alert-dialog"

describe("AddPluginDomainAlertDialog", () => {
  it("offers Add domain and Not now without revealing the password", () => {
    const onAdd = vi.fn()
    const onDismiss = vi.fn()

    render(
      <AddPluginDomainAlertDialog
        suggestion={{
          domain: "index.example.com",
          pluginId: "example-drive-index",
          pluginName: "Example Drive Index",
          sanitizedUrl: "https://index.example.com/0:/Movies/",
          username: "source-user",
          password: "source-secret",
          pluginServerId: "lynvo-plugin-server",
        }}
        isAdding={false}
        onAdd={onAdd}
        onDismiss={onDismiss}
      />
    )

    expect(
      screen.getByRole("heading", {
        name: "Add this domain for faster loading?",
      })
    ).toBeInTheDocument()
    expect(screen.getByText("index.example.com")).toBeInTheDocument()
    expect(
      screen.getByText(/Lynvo recognized.*Example Drive Index/)
    ).toBeInTheDocument()
    expect(screen.queryByText("source-secret")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Add domain" }))
    expect(onAdd).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole("button", { name: "Not now" }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
