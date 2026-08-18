export const buildReleaseIdentity = (env: Env, buildTime: string) => ({
  buildTime,
  commitHash: env.COMMIT_HASH ?? "unknown",
  deploymentId: env.CF_VERSION_METADATA?.id ?? "development",
  serviceVersion: env.SERVICE_VERSION ?? "development",
})
