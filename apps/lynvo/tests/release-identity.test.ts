import { describe, expect, it } from "vitest"
import { buildReleaseIdentity } from "../workers/release-identity"

describe("buildReleaseIdentity", () => {
  it("exposes the immutable production release identity", () => {
    const env = {
      COMMIT_HASH: "abc123",
      SERVICE_VERSION: "0.1.0",
      CF_VERSION_METADATA: {
        id: "worker-version-id",
        tag: "abc123",
        timestamp: "2026-08-18T00:00:00.000Z",
      },
    } as Env

    expect(buildReleaseIdentity(env, "2026-08-18T00:00:00.000Z")).toEqual({
      buildTime: "2026-08-18T00:00:00.000Z",
      commitHash: "abc123",
      deploymentId: "worker-version-id",
      serviceVersion: "0.1.0",
    })
  })

  it("uses explicit development values when release bindings are absent", () => {
    expect(buildReleaseIdentity({} as Env, "local-build")).toEqual({
      buildTime: "local-build",
      commitHash: "unknown",
      deploymentId: "development",
      serviceVersion: "development",
    })
  })
})
