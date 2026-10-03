/**
 * Awaiting the room fetch is deliberate. Connected clients only poll for a
 * missed version while their realtime socket is disconnected, so a client
 * that misses this push has no poll to recover with. The await keeps the
 * guarantee that the room has processed the notification before the
 * mutation response returns; moving it to waitUntil would let a connected
 * client that missed the push stay stale until its next own mutation or a
 * reconnect, in exchange for removing one Durable Object round trip from
 * the response path.
 */
export const notifyAccountDataChanged = async (
  env: Env,
  userId: string,
  version: number
): Promise<void> => {
  await env.USER_REALTIME_ROOM?.getByName(userId).fetch(
    new Request("https://realtime.internal/notify-data-changed", {
      method: "POST",
      body: JSON.stringify({ version }),
    })
  )
}
