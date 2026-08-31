import { describe, expect, it } from "vitest"
import { buildReleaseIdentity } from "../workers/release-identity"

describe("buildReleaseIdentity", () => {
  it("prefers explicit release bindings over version metadata", () => {
    // SAFETY: buildReleaseIdentity only reads the release metadata fields supplied below.
    const env = {
      COMMIT_HASH: "explicit-commit",
      SERVICE_VERSION: "9.9.9",
      CF_VERSION_METADATA: {
        id: "worker-version-id",
        tag: "metadata-commit",
        timestamp: "2026-08-18T00:00:00.000Z",
      },
    } as Env

    const identity = buildReleaseIdentity(env, "2026-08-18T00:00:00.000Z")
    expect(identity.commitHash).toBe("explicit-commit")
    expect(identity.serviceVersion).toBe("9.9.9")
  })

  it("uses explicit development values when release bindings are absent", () => {
    // SAFETY: Missing optional release bindings are the development case under test.
    const env = {} as Env
    expect(buildReleaseIdentity(env, "local-build")).toEqual({
      buildTime: "local-build",
      commitHash: "unknown",
      deploymentId: "development",
      serviceVersion: "development",
    })
  })
})
