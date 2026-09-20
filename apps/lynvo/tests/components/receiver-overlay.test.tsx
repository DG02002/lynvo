import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ReceiverOverlayView } from "~/components/receiver-overlay"

describe("ReceiverOverlay", () => {
  it("moves focus to Disconnect and restores it to the previous control", async () => {
    const handleReceiverDisconnect = vi.fn().mockResolvedValue(undefined)
    const view = render(
      <>
        <button type="button">Open Remote Play</button>
        <ReceiverOverlayView
          controllingDevices={[]}
          handleReceiverDisconnect={handleReceiverDisconnect}
        />
      </>
    )
    const previousControl = screen.getByRole("button", {
      name: "Open Remote Play",
    })
    previousControl.focus()

    view.rerender(
      <>
        <button type="button">Open Remote Play</button>
        <ReceiverOverlayView
          controllingDevices={[{ id: "controller-1", name: "Living room TV" }]}
          handleReceiverDisconnect={handleReceiverDisconnect}
        />
      </>
    )

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Disconnect" })).toHaveFocus()
    )

    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }))
    expect(handleReceiverDisconnect).toHaveBeenCalledOnce()

    view.rerender(
      <>
        <button type="button">Open Remote Play</button>
        <ReceiverOverlayView
          controllingDevices={[]}
          handleReceiverDisconnect={handleReceiverDisconnect}
        />
      </>
    )

    await waitFor(() => expect(previousControl).toHaveFocus())
  })
})
