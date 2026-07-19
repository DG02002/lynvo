const CLIENT_SESSION_KEY = "lynvo_realtime_client_session_id"

export function getClientSessionId() {
  if (typeof window === "undefined") {
    return "server"
  }

  let id = sessionStorage.getItem(CLIENT_SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(CLIENT_SESSION_KEY, id)
  }
  return id
}
