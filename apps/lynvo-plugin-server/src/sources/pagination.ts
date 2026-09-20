import {
  EXTRACTION_ELAPSED_TIME_LIMIT_MS,
  EXTRACTION_NODE_LIMIT,
  PAGINATION_PAGE_LIMIT,
} from "../constants"

export interface UpstreamPage<Page> {
  readonly value: Page
  readonly nextToken?: string
  readonly nextPageIndex?: number
}

export interface PaginateUpstreamOptions {
  readonly sourceName: string
  readonly initialToken?: string
  readonly startedAtMs?: number
  readonly now?: () => number
}

export const paginateUpstream = async <Page, Node>(
  fetchPage: (token: string, pageIndex: number) => Promise<UpstreamPage<Page>>,
  toNodes: (page: Page) => readonly Node[],
  options: PaginateUpstreamOptions
): Promise<Node[]> => {
  const nodes: Node[] = []
  const seenTokens = new Set<string>()
  const startedAtMs = options.startedAtMs ?? Date.now()
  const now = options.now ?? Date.now

  const visitPage = async (token: string, pageIndex: number): Promise<void> => {
    if (
      pageIndex >= PAGINATION_PAGE_LIMIT ||
      now() - startedAtMs >= EXTRACTION_ELAPSED_TIME_LIMIT_MS
    ) {
      throw new Error(`${options.sourceName} pagination exceeded its limit.`)
    }
    if (token && seenTokens.has(token)) {
      throw new Error(`${options.sourceName} repeated a continuation token.`)
    }
    if (token) {
      seenTokens.add(token)
    }

    const result = await fetchPage(token, pageIndex)
    nodes.push(...toNodes(result.value))
    if (nodes.length > EXTRACTION_NODE_LIMIT) {
      throw new Error(`${options.sourceName} returned too many nodes.`)
    }
    if (result.nextToken) {
      await visitPage(result.nextToken, result.nextPageIndex ?? pageIndex + 1)
    }
  }

  await visitPage(options.initialToken ?? "", 0)
  return nodes
}
