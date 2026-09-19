import { Schema } from "effect"
import { describe, expect, it } from "vitest"

import {
  presentSavedLinkCommandFailure,
  SavedLinkCommandFailureSchema,
} from "~/features/links/saved-link-command-failure"

describe("saved-link command failure presentation", () => {
  it("round-trips every failure variant through the command schema", () => {
    const failures: SavedLinkCommandFailure[] = [
      { kind: "storage-limit", usedBytes: 10, limitBytes: 20 },
      { kind: "link-too-large", sizeBytes: 30, limitBytes: 20 },
      { kind: "session-expired" },
      { kind: "session-changed" },
      { kind: "csrf-expired" },
      {
        kind: "validation",
        message: "The saved link is invalid.",
        code: "UNSUPPORTED_URL",
      },
      { kind: "temporarily-unavailable", reference: "request-one" },
      { kind: "transient" },
      { kind: "rate-limited" },
      { kind: "plugin-server-down" },
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

  it("presents extraction failures with the remedy for each failure kind", () => {
    expect(presentSavedLinkCommandFailure({ kind: "transient" })).toBe(
      "Extraction is temporarily unavailable. Try again in a moment."
    )
    expect(
      presentSavedLinkCommandFailure({
        kind: "rate-limited",
      })
    ).toBe("Extraction is rate-limited. Wait a moment, then try again.")
    expect(presentSavedLinkCommandFailure({ kind: "plugin-server-down" })).toBe(
      "The Plugin Server is unavailable. Try again later or choose another Plugin Server."
    )
  })
})
