import { useEffect } from "react"
import { remoteRealtimeEventSchema } from "./schemas"

export const useRemoteRealtimeEvents = (
  receive: (event: RemoteRealtimeEvent) => void
) => {
  useEffect(() => {
    const handler = (event: Event) => {
      if (!(event instanceof CustomEvent)) {
        return
      }
      const parsed = remoteRealtimeEventSchema.safeParse(event.detail)
      if (parsed.success) {
        receive(parsed.data)
      }
    }
    window.addEventListener("lynvo:remote-event", handler)
    return () => window.removeEventListener("lynvo:remote-event", handler)
  }, [receive])
}
