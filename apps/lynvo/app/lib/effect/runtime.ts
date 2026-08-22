import { Layer, ManagedRuntime } from "effect"
import { CloudflareEnv } from "./services/CloudflareEnv"
import { ExtractionService } from "./services/extraction-service"
import { PluginCredentialVault } from "./services/plugin-credential-vault"

const createRuntime = (env: Env) => {
  const environmentLayer = Layer.succeed(CloudflareEnv, env)
  const infrastructureLayer = PluginCredentialVault.layer.pipe(
    Layer.provide(environmentLayer)
  )
  const applicationLayer = ExtractionService.layer.pipe(
    Layer.provide(infrastructureLayer),
    Layer.provide(environmentLayer)
  )
  return ManagedRuntime.make(
    Layer.mergeAll(environmentLayer, infrastructureLayer, applicationLayer)
  )
}

let runtime: ReturnType<typeof createRuntime> | undefined

export const getRuntime = (env: Env): ReturnType<typeof createRuntime> => {
  runtime ??= createRuntime(env)
  return runtime
}
