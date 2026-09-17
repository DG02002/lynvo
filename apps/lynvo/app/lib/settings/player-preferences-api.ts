import type { PlayerPreferences } from "~/lib/api-contracts"
import { client } from "~/lib/api/client"

export const loadCloudPlayerPreferences = () =>
  client.settings.getPlayerPreferences()

export const saveCloudPlayerPreferences = (preferences: PlayerPreferences) =>
  client.settings
    .updatePlayerPreferences({ payload: preferences })
    .then(() => undefined)
