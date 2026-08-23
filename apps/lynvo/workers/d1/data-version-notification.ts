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
