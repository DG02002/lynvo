import { Schema } from "effect"
import { describe, expect, it, vi } from "vitest"
import {
  presentSavedLinkCommandFailure,
  SavedLinkCommandFailureSchema,
  SavedLinkCommandError,
} from "~/features/links/saved-link-command-failure"
import {
  runSavedLinkCommand,
  toSavedLinkCommandError,
} from "~/features/links/saved-link-command-adapter"

describe("saved-link command failure presentation", () => {
  it("round-trips every failure variant through the command schema", () => {
    const failures: SavedLinkCommandFailure[] = [
      { kind: "storage-limit", usedBytes: 10, limitBytes: 20 },
      { kind: "link-too-large", sizeBytes: 30, limitBytes: 20 },
      { kind: "session-expired" },
      { kind: "session-changed" },
      { kind: "csrf-expired" },
      { kind: "validation", message: "The saved link is invalid." },
      { kind: "temporarily-unavailable", reference: "request-one" },
    ]

    for (const failure of failures) {
      const encoded = Schema.encodeSync(SavedLinkCommandFailureSchema)(failure)
      expect(
        Schema.decodeUnknownSync(SavedLinkCommandFailureSchema)(encoded)
      ).toEqual(failure)
      expect(presentSavedLinkCommandFailure(failure)).not.toHaveLength(0)
    }
  })

  it("mentions full account storage only for a storage-limit failure", () => {
    const storageMessage = presentSavedLinkCommandFailure({
      kind: "storage-limit",
      usedBytes: 1_048_576,
      limitBytes: 1_048_576,
    })
    const unavailableMessage = presentSavedLinkCommandFailure({
      kind: "temporarily-unavailable",
      reference: "request-one",
    })

    expect(storageMessage).toContain("storage is full")
    expect(unavailableMessage).toBe(
      "The link couldn’t be saved right now. Try again. Reference: request-one"
    )
    expect(unavailableMessage).not.toContain("storage")
  })

  it("maps structured dependency failures without reading their messages", () => {
    const first = toSavedLinkCommandError(
      {
        message: "old dependency wording",
        data: {
          kind: "link-too-large",
          sizeBytes: 300_000,
          limitBytes: 262_144,
        },
      },
      "request-one"
    )
    const changedMessage = toSavedLinkCommandError(
      { message: "completely different wording" },
      "request-two"
    )

    expect(first.failure).toEqual({
      kind: "link-too-large",
      sizeBytes: 300_000,
      limitBytes: 262_144,
    })
    expect(changedMessage.failure).toEqual({
      kind: "temporarily-unavailable",
      reference: "request-two",
    })
  })

  it("automatically retries one temporary failure", async () => {
    const execute = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(
        new SavedLinkCommandError({
          failure: {
            kind: "temporarily-unavailable",
            reference: "request-one",
          },
        })
      )
      .mockResolvedValueOnce("created-once")

    await expect(runSavedLinkCommand(execute)).resolves.toBe("created-once")
    expect(execute).toHaveBeenCalledTimes(2)
  })
})
