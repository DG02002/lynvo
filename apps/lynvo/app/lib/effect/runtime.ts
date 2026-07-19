import { Layer, ManagedRuntime } from "effect"
import { AuthSessionService } from "./services/AuthSessionService"
import { CloudflareEnv } from "./services/CloudflareEnv"
import { ConvexService } from "./services/ConvexService"
import { ExtractorService } from "./services/ExtractorService"
import { PluginCredentialVault } from "./services/plugin-credential-vault"

const createRuntime = (env: Env) => {
  const environmentLayer = Layer.succeed(CloudflareEnv, env)
  const infrastructureLayer = Layer.mergeAll(
    ConvexService.layer,
    PluginCredentialVault.layer
  ).pipe(Layer.provide(environmentLayer))
  const applicationLayer = Layer.mergeAll(
    AuthSessionService.layer,
    ExtractorService.layer
  ).pipe(Layer.provide(Layer.merge(environmentLayer, infrastructureLayer)))

  return ManagedRuntime.make(
    Layer.mergeAll(environmentLayer, infrastructureLayer, applicationLayer)
  )
}

let runtime: ReturnType<typeof createRuntime> | undefined

export const getRuntime = (env: Env): ReturnType<typeof createRuntime> => {
  runtime ??= createRuntime(env)
  return runtime
}
