import * as React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ExternalExtractorsSection } from "~/features/site/settings/plugins-settings"

const ExternalExtractorsHarness = ({
  onAddWorker,
}: {
  onAddWorker: (value: {
    baseUrl: string
    apiKey: string
  }) => Promise<string | null>
}) => {
  const [open, setOpen] = React.useState(false)
  return (
    <ExternalExtractorsSection
      workers={[]}
      isAddWorkerOpen={open}
      onAddWorkerOpenChange={setOpen}
      onAddWorker={onAddWorker}
      onDeleteWorker={vi.fn()}
      onRefreshWorker={vi.fn()}
      onToggleWorker={vi.fn()}
    />
  )
}

describe("ExternalExtractorsSection", () => {
  it("does not render an empty-state message when no workers are configured", () => {
    render(<ExternalExtractorsHarness onAddWorker={vi.fn()} />)

    expect(
      screen.queryByText("No custom extractor workers configured.")
    ).not.toBeInTheDocument()
  })

  it("validates and submits an external extractor form", async () => {
    const onAddWorker = vi.fn().mockResolvedValue(null)
    render(<ExternalExtractorsHarness onAddWorker={onAddWorker} />)

    fireEvent.click(
      screen.getByRole("button", { name: "Add external extractor" })
    )
    fireEvent.click(screen.getByRole("button", { name: "Add worker" }))

    expect(await screen.findByText("Base URL is required.")).toBeVisible()
    expect(onAddWorker).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText("Base URL"), {
      target: { value: "https://worker.example.com" },
    })
    fireEvent.change(screen.getByLabelText("API Key"), {
      target: { value: "secret" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add worker" }))

    await waitFor(() => {
      expect(onAddWorker).toHaveBeenCalledWith({
        baseUrl: "https://worker.example.com",
        apiKey: "secret",
      })
    })
    await waitFor(() => {
      expect(
        screen.queryByRole("heading", {
          name: "Add custom extractor worker",
        })
      ).not.toBeInTheDocument()
    })
  })

  it("keeps a registration failure visible in the form", async () => {
    const onAddWorker = vi
      .fn()
      .mockResolvedValue("API key verification failed.")
    render(<ExternalExtractorsHarness onAddWorker={onAddWorker} />)

    fireEvent.click(
      screen.getByRole("button", { name: "Add external extractor" })
    )
    fireEvent.change(screen.getByLabelText("Base URL"), {
      target: { value: "https://worker.example.com" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add worker" }))

    expect(
      await screen.findByText("API key verification failed.")
    ).toBeVisible()
    expect(
      screen.getByRole("heading", { name: "Add custom extractor worker" })
    ).toBeVisible()
  })
})
