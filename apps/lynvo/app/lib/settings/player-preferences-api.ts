import { client } from "~/lib/api/client"
import type { PlayerPreferences } from "~/lib/api/contracts"

export const loadCloudPlayerPreferences = () =>
  client.settings.getPlayerPreferences()

export const saveCloudPlayerPreferences = (preferences: PlayerPreferences) =>
  client.settings
    .updatePlayerPreferences({ payload: preferences })
    .then(() => undefined)
