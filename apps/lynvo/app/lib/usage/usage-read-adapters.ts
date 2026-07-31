import { Effect } from "effect"
import { client } from "../effect/api/client"
import { createUsageReadModule } from "./usage-read"

const usageRead = createUsageReadModule({
  readLynvo: (timeBucket) =>
    Effect.runPromise(client.settings.getLynvoUsage({ query: { timeBucket } })),
  readCustom: () => Effect.runPromise(client.pluginServers.usage()),
})

export const readUsageSnapshot = (
  input: UsageReadInput
): Promise<UsageReadSnapshot> => usageRead.read(input)
