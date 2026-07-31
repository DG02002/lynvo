import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AddSourceDomainAlertDialog } from "~/components/links/add-source-domain-alert-dialog"

describe("AddSourceDomainAlertDialog", () => {
  it("offers only Add and Not now without revealing the password", () => {
    const onAdd = vi.fn()
    const onDismiss = vi.fn()

    render(
      <AddSourceDomainAlertDialog
        suggestion={{
          domain: "index.example.com",
          pluginId: "bhadoo-google-drive-index",
          pluginName: "Bhadoo Google Drive Index",
          sanitizedUrl: "https://index.example.com/0:/Movies/",
          username: "source-user",
          password: "source-secret",
          workerId: "official-extractor",
        }}
        isAdding={false}
        onAdd={onAdd}
        onDismiss={onDismiss}
      />
    )

    expect(
      screen.getByRole("heading", {
        name: "Save this site for faster loading?",
      })
    ).toBeInTheDocument()
    expect(screen.getByText("index.example.com")).toBeInTheDocument()
    expect(
      screen.getByText(/Lynvo recognized.*Bhadoo Google Drive Index/)
    ).toBeInTheDocument()
    expect(screen.queryByText("source-secret")).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    expect(onAdd).toHaveBeenCalledOnce()

    fireEvent.click(screen.getByRole("button", { name: "Not now" }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
