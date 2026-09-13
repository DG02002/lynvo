import { describe, expect, it } from "vitest"
import { Result, Schema } from "effect"
import {
  createNodeExtractRequest,
  getExtractTarget,
  nodeInputSchema,
  resolvableNodeSchema,
} from "../src/index"

const nodeIdentities = [
  { label: "node URL", nodeUrl: "https://example.com/node" },
  { label: "resource ID", resourceId: "opaque-resource-id" },
  {
    label: "node URL and resource ID",
    nodeUrl: "https://example.com/node",
    resourceId: "opaque-resource-id",
  },
]

describe("node identity", () => {
  it.each(nodeIdentities)("accepts $label for node input", (identity) => {
    const result = Schema.decodeUnknownResult(nodeInputSchema)({
      kind: "node",
      ...identity,
    })

    expect(Result.isSuccess(result)).toBe(true)
  })

  it.each(nodeIdentities)("accepts $label for resolvable nodes", (identity) => {
    const result = Schema.decodeUnknownResult(resolvableNodeSchema)({
      kind: "resolvable",
      label: "Resolvable node",
      ...identity,
    })

    expect(Result.isSuccess(result)).toBe(true)
  })

  it("rejects node input without an identity", () => {
    const result = Schema.decodeUnknownResult(nodeInputSchema)({
      kind: "node",
    })

    expect(Result.isFailure(result)).toBe(true)
  })

  it("rejects resolvable nodes without an identity", () => {
    const result = Schema.decodeUnknownResult(resolvableNodeSchema)({
      kind: "resolvable",
      label: "Resolvable node",
    })

    expect(Result.isFailure(result)).toBe(true)
  })

  it("uses a resource ID when a node URL is absent", () => {
    const request = createNodeExtractRequest({
      resourceId: "opaque-resource-id",
    })

    expect(request).toEqual({
      input: { kind: "node", resourceId: "opaque-resource-id" },
    })
    expect(getExtractTarget(request)).toEqual({
      kind: "resourceId",
      resourceId: "opaque-resource-id",
    })
  })
})
