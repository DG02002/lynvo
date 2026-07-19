export interface ExtractorRequestEvent {
  requestId: string
  operation: string
  sourceId?: string
  targetHost?: string
  inputKind?: string
  resultNodeCount?: number
  errorCode?: string
}

export const logRequestEvent = (event: ExtractorRequestEvent): void => {
  console.log(JSON.stringify({ event: "official_extractor_request", ...event }))
}
