import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { ResolvableLinkMenu } from "~/components/save-list/resolvable-link-menu"

describe("ResolvableLinkMenu", () => {
  it("calls the refresh action from the Refresh menu item", async () => {
    const onRefresh = vi.fn()

    render(
      <ResolvableLinkMenu
        itemLabel="Example episode"
        onCopyLink={vi.fn()}
        onRefresh={onRefresh}
        onRemove={vi.fn()}
        triggerClassName=""
      />
    )

    fireEvent.click(
      screen.getByRole("button", { name: "Open menu for Example episode" })
    )
    const dropdownMenu = await waitFor(() => {
      const menu = screen.getByRole("menu")
      expect(menu).toBeVisible()
      return menu
    })

    expect(dropdownMenu).toHaveTextContent("Refresh")
    expect(dropdownMenu).not.toHaveTextContent("Refresh playable links")
    fireEvent.click(screen.getByRole("menuitem", { name: "Refresh" }))
    expect(onRefresh).toHaveBeenCalledOnce()
  })
})
