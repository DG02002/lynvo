import { Context } from "effect"

export class CloudflareEnv extends Context.Service<CloudflareEnv, Env>()(
  "app/effect/services/CloudflareEnv"
) {}
