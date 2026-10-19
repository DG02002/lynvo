import type { CSSProperties } from "react"

export type CSSVariableStyle<Names extends string> = CSSProperties &
  Record<Names, string>
