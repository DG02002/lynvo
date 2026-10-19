import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { toast } from "~/components/ui/toast"
import { StorageSettings } from "~/features/site/settings/storage-settings"

import {
  USER_STORAGE_LIMIT_BYTES,
  USER_STORAGE_WARNING_BYTES,
} from "../workers/constants"

const storageSettingsSnapshot = () => ({
  enforcedBytes: 1_024,
  linkBytes: 1_024,
  pluginServerBytes: 0,
  pluginDomainBytes: 0,
  profileBytes: 0,
  savedLinkCount: 2,
  averageLinkBytes: 512,
  storageLimitBytes: USER_STORAGE_LIMIT_BYTES,
  storageWarningBytes: USER_STORAGE_WARNING_BYTES,
  linkLimitBytes: 4_096,
  retentionDays: 30,
  retentionDayOptions: [7, 15, 30],
  defaultRetentionDays: 30,
  maxRetentionDays: 30,
})

const getRequestUrl = (input: RequestInfo | URL) => {
  if (input instanceof Request) {
    return input.url
  }
  return input instanceof URL ? input.href : input
}

describe("Storage settings browser data", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("loads storage usage through a same-origin Lynvo operation", async () => {
    const requestedPaths: Array<string> = []
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(getRequestUrl(input), "https://lynvo.test")
        requestedPaths.push(url.pathname)
        if (url.pathname === "/api/data/storage-settings") {
          return Response.json(storageSettingsSnapshot())
        }
        return new Response(null, { status: 404 })
      })
    )
    render(<StorageSettings />)

    expect(await screen.findByText("1.00 KB of 3.00 MB used")).toBeVisible()
    expect(
      screen.getByRole("combobox", { name: "Delete saved links after" })
    ).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "Delete all" }))
    expect(
      screen.getByText(
        "This permanently removes every saved link and everything inside it from the account. This cannot be undone."
      )
    ).toBeVisible()
    expect(requestedPaths).toContain("/api/data/storage-settings")
  })

  it("shows a retry when storage settings fail to load", async () => {
    let requestCount = 0
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(getRequestUrl(input), "https://lynvo.test")
        if (url.pathname === "/api/data/storage-settings") {
          requestCount += 1
          if (requestCount === 1) {
            throw new Error("network down")
          }
          return Response.json(storageSettingsSnapshot())
        }
        return new Response(null, { status: 404 })
      })
    )

    render(<StorageSettings />)

    fireEvent.click(await screen.findByRole("button", { name: "Try again" }))

    expect(await screen.findByText("1.00 KB of 3.00 MB used")).toBeVisible()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })

  it("surfaces a rejected retention preview once and lets the select retry", async () => {
    let previewCount = 0
    const requestedOperations: Array<string> = []
    const unhandledRejections: Array<unknown> = []
    const errorNotifications: Array<{ title: string }> = []
    const unsubscribeFromToast = toast[" subscribe"](({ action, options }) => {
      if (action === "add" && options.type === "error") {
        errorNotifications.push(options)
      }
    })
    const recordUnhandledRejection = (event: PromiseRejectionEvent) => {
      unhandledRejections.push(event.reason)
      event.preventDefault()
    }
    window.addEventListener("unhandledrejection", recordUnhandledRejection)
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = input instanceof Request ? input : undefined
        const url = new URL(getRequestUrl(input), "https://lynvo.test")
        const method = init?.method ?? request?.method ?? "GET"
        requestedOperations.push(`${method} ${url.pathname}`)
        if (url.pathname === "/api/data/storage-settings/retention-preview") {
          previewCount += 1
          if (previewCount === 1) {
            return new Response("preview unavailable", { status: 503 })
          }
          return Response.json({ expiredLinkCount: 0 })
        }
        if (
          url.pathname === "/api/data/storage-settings" &&
          method === "PATCH"
        ) {
          return Response.json({
            success: true,
            deletedLinks: 0,
            dataVersion: 1,
          })
        }
        if (url.pathname === "/api/data/storage-settings") {
          return Response.json(storageSettingsSnapshot())
        }
        return new Response(null, { status: 404 })
      })
    )

    render(<StorageSettings />)

    const retentionSelect = await screen.findByRole("combobox", {
      name: "Delete saved links after",
    })
    fireEvent.click(retentionSelect)
    const sevenDayOption = await screen.findByRole("option", { name: "7 days" })
    fireEvent.pointerDown(sevenDayOption, {
      button: 0,
      isPrimary: true,
      pointerType: "mouse",
    })

    const errorTitle = "Couldn’t check the auto-delete period"
    fireEvent.click(sevenDayOption)
    await waitFor(() =>
      expect(
        errorNotifications.filter(
          (notification) => notification.title === errorTitle
        )
      ).toHaveLength(1)
    )

    fireEvent.click(retentionSelect)
    const fifteenDayOption = await screen.findByRole("option", {
      name: "15 days",
    })
    fireEvent.pointerDown(fifteenDayOption, {
      button: 0,
      isPrimary: true,
      pointerType: "mouse",
    })
    fireEvent.click(fifteenDayOption)
    await waitFor(() =>
      expect(requestedOperations).toContain("PATCH /api/data/storage-settings")
    )
    expect(requestedOperations).toContain("PATCH /api/data/storage-settings")
    expect(
      errorNotifications.filter(
        (notification) => notification.title === errorTitle
      )
    ).toHaveLength(1)
    expect(unhandledRejections).toEqual([])
    unsubscribeFromToast()
    window.removeEventListener("unhandledrejection", recordUnhandledRejection)
  })
})
