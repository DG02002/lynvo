import { z } from "zod"
import { SavedLinkCommandError } from "../saved-link-command-failure"
import { DATA_VERSION_RESPONSE_HEADER } from "~/lib/constants"
import {
  parseLinkMetadata,
  toLinkViewItem,
  type SavedLink,
} from "~/features/links/links.mapper"

declare global {
  interface SavedLinkApiRecord {
    id: string
    url: string
    title: string | null
    metaJson: string | null
    createdAt: number
    updatedAt: number
  }

  interface SavedLinkListResponse {
    links: SavedLinkApiRecord[]
    dataVersion: number
  }

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

  interface ClearSavedLinksResponse {
    success: boolean
    deletedLinks: number
    dataVersion: number
  }
}

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
    return toLinkViewItem(toSavedLink(record))
  } catch (error) {
    console.error("Unable to hydrate saved link", { linkId: record.id, error })
    return undefined
  }
}

const savedLinkApiRecordSchema = z.object({
  id: z.string(),
  url: z.string(),
  title: z.string().nullable(),
  metaJson: z.string().nullable(),
  createdAt: z.number(),
  updatedAt: z.number(),
})

const savedLinkListResponseSchema = z.object({
  links: z.array(savedLinkApiRecordSchema),
})

const failureBodySchema = z.object({
  failure: z.object({
    kind: z.string(),
    message: z.string().optional(),
    usedBytes: z.number().optional(),
    sizeBytes: z.number().optional(),
    limitBytes: z.number().optional(),
    reference: z.string().optional(),
  }),
})

const toCommandError = async (
  httpResponse: globalThis.Response
): Promise<SavedLinkCommandError> => {
  const parsed = failureBodySchema.safeParse(
    await httpResponse.json().catch(() => null)
  )
  if (!parsed.success) {
    return new SavedLinkCommandError({
      failure: {
        kind: "temporarily-unavailable",
        reference: `http-${httpResponse.status}`,
      },
    })
  }
  const failure = parsed.data.failure
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

const sendDataRequest = async (
  path: string,
  init?: RequestInit
): Promise<globalThis.Response> => {
  let httpResponse: globalThis.Response
  try {
    httpResponse = await fetch(path, {
      credentials: "same-origin",
      signal: AbortSignal.timeout?.(DATA_API_TIMEOUT_MS),
      ...init,
      headers: {
        Accept: "application/json",
        ...init?.headers,
      },
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

const requestDataJson = async <ResponseBody>(
  path: string,
  init?: RequestInit
): Promise<ResponseBody> => {
  const httpResponse = await sendDataRequest(path, init)
  return await httpResponse.json()
}

const mutationRequest = (path: string, payloadJson: string): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: payloadJson,
})

export interface CreateOrUpdateSavedLinkInput {
  readonly operationId: string
  readonly url: string
  readonly title?: string | undefined
  readonly meta?: string | undefined
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
}

export type SavedLinkApiMetadataOperation =
  ApplyMetadataOperationInput["operation"]

export const linksDataApi = {
  listSavedLinks: async (): Promise<SavedLinkListResponse> => {
    const httpResponse = await sendDataRequest("/api/data/links")
    const body = savedLinkListResponseSchema.parse(await httpResponse.json())
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
    requestDataJson(
      "/api/data/links/create-or-update",
      mutationRequest("/api/data/links/create-or-update", JSON.stringify(input))
    ),
  updateMeta: (
    input: UpdateSavedLinkMetaInput
  ): Promise<SavedLinkMutationResponse> =>
    requestDataJson(
      "/api/data/links/update-meta",
      mutationRequest("/api/data/links/update-meta", JSON.stringify(input))
    ),
  applyMetadataOperation: (
    input: ApplyMetadataOperationInput
  ): Promise<SavedLinkMutationResponse> =>
    requestDataJson(
      "/api/data/links/apply-metadata-operation",
      mutationRequest(
        "/api/data/links/apply-metadata-operation",
        JSON.stringify(input)
      )
    ),
  deleteById: (input: {
    readonly id: string
  }): Promise<SavedLinkMutationResponse> =>
    requestDataJson(
      "/api/data/links/delete",
      mutationRequest("/api/data/links/delete", JSON.stringify(input))
    ),
  clearSavedLinks: (): Promise<ClearSavedLinksResponse> =>
    requestDataJson(
      "/api/data/links/clear",
      mutationRequest("/api/data/links/clear", "{}")
    ),
}
