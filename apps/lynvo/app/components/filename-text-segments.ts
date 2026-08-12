const UNICODE_LETTER_PATTERN = /^\p{L}$/u

const isFilenameBreakOpportunity = (value: string, index: number) => {
  const character = value[index]
  if (character === "_") {
    return true
  }
  if (character !== "." || index === value.lastIndexOf(".")) {
    return false
  }
  const nextCharacter = value[index + 1]
  return (
    nextCharacter !== undefined && UNICODE_LETTER_PATTERN.test(nextCharacter)
  )
}

export const getFilenameBreakSegments = (value: string) => {
  const segments: string[] = []
  let segmentStart = 0
  for (let index = 0; index < value.length; index += 1) {
    if (!isFilenameBreakOpportunity(value, index)) {
      continue
    }
    segments.push(value.slice(segmentStart, index + 1))
    segmentStart = index + 1
  }
  segments.push(value.slice(segmentStart))
  return segments
}
