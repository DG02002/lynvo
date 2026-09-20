import { Result, Schema } from "effect"

import { parseLinkMetadata } from "~/features/links/link-metadata-normalization"
import {
  toLinkViewItem,
  type SavedLink,
} from "~/features/links/link-view-models"
import type { LinkExtractionStatus } from "~/features/links/types"
import { requestSameOrigin, type RequestOptions } from "~/lib/api/client"
import { DATA_VERSION_RESPONSE_HEADER } from "~/lib/constants"

import {
  SavedLinkListResponseSchema,
  type SavedLinkApiRecord,
  type SavedLinkListResponse,
} from "../../../../shared/api-contracts"
import { SavedLinkCommandError } from "../saved-link-command-failure"

declare global {
  interface CreateOrUpdateSavedLinkResponse {
    id: string | null
    replayed: boolean
    dataVersion: number
  }

  interface SavedLinkMutationResponse {
    success: boolean
    replayed: boolean
    dataVersion: number
  }
}

export type SavedLinkResponseBody =
  | Pick<SavedLinkListResponse, "links">
  | CreateOrUpdateSavedLinkResponse
  | SavedLinkMutationResponse

const toSavedLink = (record: SavedLinkApiRecord): SavedLink => ({
  id: record.id,
  url: record.url,
  title: record.title ?? undefined,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  metadata: parseLinkMetadata(record.metaJson),
})

export const savedLinkApiRecordToViewItem = (record: SavedLinkApiRecord) => {
  try {
    const extractionStatus: LinkExtractionStatus = {
      state: record.extractionState ?? "complete",
    }
    if (record.extractionError) {
      extractionStatus.error = record.extractionError
    }
    return {
      ...toLinkViewItem(toSavedLink(record)),
      extractionStatus,
    }
  } catch (error) {
    console.error("Unable to hydrate saved link", { linkId: record.id, error })
    return undefined
  }
}

const failureBodySchema = Schema.Struct({
  failure: Schema.Struct({
    kind: Schema.String,
    message: Schema.optional(Schema.String),
    usedBytes: Schema.optional(Schema.Number),
    sizeBytes: Schema.optional(Schema.Number),
    limitBytes: Schema.optional(Schema.Number),
    reference: Schema.optional(Schema.String),
  }),
})

const toCommandError = async (
  httpResponse: globalThis.Response
): Promise<SavedLinkCommandError> => {
  const parsed = Schema.decodeUnknownResult(failureBodySchema)(
    await httpResponse.json().catch(() => null)
  )
  if (Result.isFailure(parsed)) {
    return new SavedLinkCommandError({
      failure: {
        kind: "temporarily-unavailable",
        reference: `http-${httpResponse.status}`,
      },
    })
  }
  const { failure } = parsed.success
  switch (failure.kind) {
    case "storage-limit":
      if (failure.usedBytes !== undefined && failure.limitBytes !== undefined) {
        return new SavedLinkCommandError({
          failure: {
            kind: "storage-limit",
            usedBytes: failure.usedBytes,
            limitBytes: failure.limitBytes,
          },
        })
      }
      break
    case "link-too-large":
      if (failure.sizeBytes !== undefined && failure.limitBytes !== undefined) {
        return new SavedLinkCommandError({
          failure: {
            kind: "link-too-large",
            sizeBytes: failure.sizeBytes,
            limitBytes: failure.limitBytes,
          },
        })
      }
      break
    case "session-expired":
    case "session-changed":
    case "csrf-expired":
      return new SavedLinkCommandError({ failure: { kind: failure.kind } })
    case "validation":
      return new SavedLinkCommandError({
        failure: { kind: "validation", message: failure.message ?? "" },
      })
    default:
      break
  }
  return new SavedLinkCommandError({
    failure: {
      kind: "temporarily-unavailable",
      reference: failure.reference ?? `http-${httpResponse.status}`,
    },
  })
}

const DATA_API_TIMEOUT_MS = 15_000

const sendDataRequest = async <Payload = undefined>(
  path: string,
  options: RequestOptions<Payload> = {}
): Promise<globalThis.Response> => {
  let httpResponse: globalThis.Response
  try {
    httpResponse = await requestSameOrigin(path, {
      ...options,
      headers: { Accept: "application/json", ...options.headers },
      includeSessionIdentityHeaders: false,
      timeoutMs: DATA_API_TIMEOUT_MS,
    })
  } catch (cause) {
    throw new SavedLinkCommandError({
      failure: {
        kind: "temporarily-unavailable",
        reference: cause instanceof Error ? cause.name : "network",
      },
    })
  }
  if (!httpResponse.ok) {
    throw await toCommandError(httpResponse)
  }
  return httpResponse
}

const requestDataJson = async <ResponseBody, Payload = undefined>(
  path: string,
  options?: RequestOptions<Payload>
): Promise<ResponseBody> => {
  const httpResponse = await sendDataRequest(path, options)
  return await httpResponse.json()
}

export interface CreateOrUpdateSavedLinkInput {
  readonly operationId: string
  readonly url: string
  readonly title?: string | undefined
  readonly meta: string
  readonly extractionState?: "queued"
}

export interface UpdateSavedLinkMetaInput {
  readonly operationId: string
  readonly id: string
  readonly meta: string
}

export interface ApplyMetadataOperationInput {
  readonly operationId: string
  readonly id: string
  readonly operation:
    | {
        readonly kind: "markOpened"
        readonly linkUrl: string
      }
    | {
        readonly kind: "cacheMirrors"
        readonly lazyItemUrl: string
        readonly mirrorsJson: string
      }
    | {
        readonly kind: "removeExtractedLink"
        readonly linkKey: string
        readonly linkUrl: string
      }
    | {
        readonly kind: "replaceExtraction"
        readonly expectedExtractionJson: string
        readonly extractedLinksJson: string
      }
    | {
        readonly kind: "setArtwork"
        readonly providerId: number
        readonly title: string
        readonly year?: number
        readonly mediaKind?: "movie" | "tv"
      }
}

export type SavedLinkApiMetadataOperation =
  ApplyMetadataOperationInput["operation"]

export const linksDataApi = {
  listSavedLinks: async (): Promise<SavedLinkListResponse> => {
    const httpResponse = await sendDataRequest("/api/data/links")
    const body = Schema.decodeUnknownSync(SavedLinkListResponseSchema)(
      await httpResponse.json()
    )
    return {
      links: body.links,
      dataVersion: Number(
        httpResponse.headers.get(DATA_VERSION_RESPONSE_HEADER) ?? "0"
      ),
    }
  },
  createOrUpdate: (
    input: CreateOrUpdateSavedLinkInput
  ): Promise<CreateOrUpdateSavedLinkResponse> =>
    requestDataJson("/api/data/links/create-or-update", {
      method: "POST",
      payload: input,
    }),
  updateMeta: (
    input: UpdateSavedLinkMetaInput
  ): Promise<SavedLinkMutationResponse> =>
    requestDataJson("/api/data/links/update-meta", {
      method: "POST",
      payload: input,
    }),
  applyMetadataOperation: (
    input: ApplyMetadataOperationInput
  ): Promise<SavedLinkMutationResponse> =>
    requestDataJson("/api/data/links/apply-metadata-operation", {
      method: "POST",
      payload: input,
    }),
  deleteById: (input: {
    readonly id: string
  }): Promise<SavedLinkMutationResponse> =>
    requestDataJson("/api/data/links/delete", {
      method: "POST",
      payload: {
        operationId: crypto.randomUUID(),
        id: input.id,
      },
    }),
}
