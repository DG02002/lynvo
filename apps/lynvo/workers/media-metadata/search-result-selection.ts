import type { TmdbSearchResult } from "./tmdb-adapter"

const normalizeTitle = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()

const levenshteinWithin = (
  left: string,
  right: string,
  limit: number
): boolean => {
  if (Math.abs(left.length - right.length) > limit) {
    return false
  }
  if (left === right) {
    return true
  }
  let previousRow = Array.from(
    { length: right.length + 1 },
    (_, index) => index
  )
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const currentRow = [leftIndex]
    let rowMinimum = leftIndex
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost =
        left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1
      const distance = Math.min(
        (previousRow[rightIndex - 1] ?? 0) + substitutionCost,
        (previousRow[rightIndex] ?? 0) + 1,
        (currentRow[rightIndex - 1] ?? 0) + 1
      )
      currentRow.push(distance)
      rowMinimum = Math.min(rowMinimum, distance)
    }
    if (rowMinimum > limit) {
      return false
    }
    previousRow = currentRow
  }
  return (previousRow[right.length] ?? Number.POSITIVE_INFINITY) <= limit
}

/** Typos of meaningful words still match: "Overload" finds "Overlord". */
const tokenMatches = (queryToken: string, candidateToken: string): boolean =>
  queryToken === candidateToken ||
  (queryToken.length >= 4 &&
    candidateToken.length >= 4 &&
    levenshteinWithin(queryToken, candidateToken, 2))

const scoreSearchResult = (
  normalizedQuery: string,
  queryTokens: readonly string[],
  result: TmdbSearchResult
): number => {
  const normalizedTitle = normalizeTitle(result.title)
  if (normalizedTitle === normalizedQuery) {
    return 1
  }
  if (normalizedTitle.startsWith(normalizedQuery)) {
    return 0.9
  }
  const candidateTokens = normalizedTitle.split(" ").filter(Boolean)
  // Year-like tokens are filters, not identity: "Overload 2015" must match
  // a plain-titled "Overlord".
  const identityTokens = queryTokens.filter(
    (queryToken) => !/^\d{4}$/.test(queryToken)
  )
  if (identityTokens.length === 0) {
    return 0
  }
  const matchedTokens = identityTokens.filter((identityToken) =>
    candidateTokens.some((candidateToken) =>
      tokenMatches(identityToken, candidateToken)
    )
  ).length
  return matchedTokens === identityTokens.length ? 0.75 : 0
}

/**
 * TMDB ranks loosely and returns fuzzy hits first when the query is
 * mistyped, so the first result is regularly a different work entirely.
 * Only a result whose title genuinely matches the query is used; when
 * nothing matches, no artwork beats wrong artwork.
 */
export const selectBestSearchResult = (
  query: string,
  results: readonly TmdbSearchResult[]
): TmdbSearchResult | undefined => {
  const normalizedQuery = normalizeTitle(query)
  const queryTokens = normalizedQuery.split(" ").filter(Boolean)
  if (queryTokens.length === 0) {
    return undefined
  }
  let bestResult: TmdbSearchResult | undefined
  let bestScore = 0
  for (const result of results) {
    const score = scoreSearchResult(normalizedQuery, queryTokens, result)
    if (score > bestScore) {
      bestResult = result
      bestScore = score
    }
  }
  return bestScore >= 0.75 ? bestResult : undefined
}
