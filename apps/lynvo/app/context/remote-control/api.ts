import { getCsrfToken } from "~/lib/utils"
import { remotePollResponseSchema } from "./schemas"

export const remoteApi = {
  connect: async (targetSessionId: string) => {
    const response = await fetch("/api/remote/connect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": getCsrfToken(),
      },
      body: JSON.stringify({ targetSessionId, action: "connect" }),
    })
    if (!response.ok) {
      throw new Error("Unable to connect the remote session")
    }
    return response
  },
  disconnect: async (targetSessionId: string) => {
    const response = await fetch("/api/remote/connect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": getCsrfToken(),
      },
      body: JSON.stringify({ targetSessionId, action: "disconnect" }),
    })
    if (!response.ok) {
      throw new Error("Unable to disconnect the remote session")
    }
    return response
  },
  send: async (targetSessionId: string, command: string, data?: unknown) => {
    const res = await fetch("/api/remote/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": getCsrfToken(),
      },
      body: JSON.stringify({
        target_session_id: targetSessionId,
        command,
        data,
      }),
    })
    if (!res.ok) {
      throw new Error("Unable to send the remote command")
    }
    return res
  },
  poll: async () => {
    const res = await fetch("/api/remote/poll")
    if (!res.ok) {
      throw new Error("Unable to check the remote session")
    }
    const value: unknown = await res.json()
    const parsed = remotePollResponseSchema.safeParse(value)
    if (!parsed.success) {
      throw new Error("The remote session returned an invalid response")
    }
    return parsed.data
  },
}
