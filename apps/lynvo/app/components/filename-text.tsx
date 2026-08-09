import * as React from "react"
import { cn } from "~/lib/utils"

interface FilenameTextProps {
  value: string
  className?: string
}

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

export const FilenameText = ({ value, className }: FilenameTextProps) => {
  const segments = getFilenameBreakSegments(value)

  return (
    <span className={cn("line-clamp-5 break-words", className)}>
      {segments.map((segment, index) => (
        <React.Fragment key={`${index}-${segment}`}>
          {segment}
          {index < segments.length - 1 && <wbr />}
        </React.Fragment>
      ))}
    </span>
  )
}
