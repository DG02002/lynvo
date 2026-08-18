import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi"
import { WebAuth, CsrfMiddleware } from "../Middleware"
import {
  UnauthorizedApiError,
  CsrfApiError,
  ConvexApiError,
  ValidationApiError,
} from "../../errors"
import { SavedLinkCommandApiError } from "~/features/links/saved-link-command-failure"

const LinkSchema = Schema.Struct({
  _id: Schema.String,
  url: Schema.String,
  title: Schema.optional(Schema.String),
  meta: Schema.optional(Schema.String),
  createdAt: Schema.Number,
  updatedAt: Schema.Number,
})

const LinksSnapshotSchema = Schema.Struct({
  results: Schema.Array(LinkSchema),
})

const SavedLinkCommitSchema = Schema.Struct({
  success: Schema.Boolean,
})

const LinkMetadataOperationSchema = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("markOpened"), linkUrl: Schema.String }),
  Schema.Struct({
    kind: Schema.Literal("cacheMirrors"),
    lazyItemUrl: Schema.String,
    mirrors: Schema.Unknown,
  }),
  Schema.Struct({
    kind: Schema.Literal("removeExtractedLink"),
    linkKey: Schema.String,
    linkUrl: Schema.String,
  }),
  Schema.Struct({
    kind: Schema.Literal("replaceExtraction"),
    expectedExtraction: Schema.Unknown,
    extractedLinks: Schema.Unknown,
  }),
])

export class LinksGroup extends HttpApiGroup.make("links")
  .add(
    HttpApiEndpoint.get("list", "/", {
      success: LinksSnapshotSchema,
      error: [UnauthorizedApiError, ConvexApiError],
    }),
    HttpApiEndpoint.post("create", "/", {
      payload: Schema.Struct({
        operationId: Schema.String,
        url: Schema.String,
        title: Schema.optional(Schema.String),
        meta: Schema.Unknown,
      }),
      success: Schema.Struct({ id: Schema.String }),
      error: [
        UnauthorizedApiError,
        CsrfApiError,
        ValidationApiError,
        ConvexApiError,
        SavedLinkCommandApiError,
      ],
    }),
    HttpApiEndpoint.delete("delete", "/:linkId", {
      params: {
        linkId: Schema.String,
      },
      success: SavedLinkCommitSchema,
      error: [
        UnauthorizedApiError,
        CsrfApiError,
        ConvexApiError,
        SavedLinkCommandApiError,
      ],
    }),
    HttpApiEndpoint.post("updateMeta", "/:linkId/meta", {
      params: {
        linkId: Schema.String,
      },
      payload: Schema.Struct({
        operationId: Schema.String,
        meta: Schema.Unknown,
      }),
      success: SavedLinkCommitSchema,
      error: [
        UnauthorizedApiError,
        CsrfApiError,
        ValidationApiError,
        ConvexApiError,
        SavedLinkCommandApiError,
      ],
    }),
    HttpApiEndpoint.post("applyMetadataOperation", "/:linkId/meta-operation", {
      params: { linkId: Schema.String },
      payload: Schema.Struct({
        operationId: Schema.String,
        operation: LinkMetadataOperationSchema,
      }),
      success: SavedLinkCommitSchema,
      error: [
        UnauthorizedApiError,
        CsrfApiError,
        ValidationApiError,
        ConvexApiError,
        SavedLinkCommandApiError,
      ],
    })
  )
  .middleware(WebAuth)
  .middleware(CsrfMiddleware)
  .prefix("/api/links") {}
