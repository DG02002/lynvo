import { Effect } from "effect"
import { client } from "../effect/api/client"
import { readLynvoUsage } from "../settings/storage-http"
import { createUsageReadModule } from "./usage-read"

const usageRead = createUsageReadModule({
  readLynvo: () => readLynvoUsage(),
  readCustom: () => Effect.runPromise(client.pluginServers.usage()),
})

export const readUsageSnapshot = (
  input: UsageReadInput
): Promise<UsageReadSnapshot> => usageRead.read(input)
