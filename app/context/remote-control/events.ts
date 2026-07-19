import { useEffect } from "react"

export const useRemoteRealtimeEvents = (
  receive: (event: RemoteRealtimeEvent) => void
) => {
  useEffect(() => {
    const handler = (event: Event) => {
      receive((event as CustomEvent).detail as RemoteRealtimeEvent)
    }
    window.addEventListener("lynvo:remote-event", handler)
    return () => window.removeEventListener("lynvo:remote-event", handler)
  }, [receive])
}
