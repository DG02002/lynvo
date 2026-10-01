const OUTLINE_VISIBILITY_PADDING_PX = 8

export const getScrollAdjustment = ({
  containerBottom,
  containerTop,
  itemBottom,
  itemTop,
}: {
  containerBottom: number
  containerTop: number
  itemBottom: number
  itemTop: number
}) => {
  if (itemTop < containerTop + OUTLINE_VISIBILITY_PADDING_PX) {
    return itemTop - containerTop - OUTLINE_VISIBILITY_PADDING_PX
  }
  if (itemBottom > containerBottom - OUTLINE_VISIBILITY_PADDING_PX) {
    return itemBottom - containerBottom + OUTLINE_VISIBILITY_PADDING_PX
  }
  return 0
}

export interface OutlineRailRow {
  bottom: number
  top: number
}

interface OutlineRailDash {
  length: number
  offset: number
  total: number
}

export interface OutlineRailPaths {
  activeDash: OutlineRailDash
  basePath: string
}

// The rail is one straight vertical line at a fixed x from the first to the
// last row; nesting is carried by link indentation, never by the rail
// stepping sideways.
export const OUTLINE_RAIL_X_PX = 1

// SVG accepts raw numbers, but measured offsets pick up float noise; trim to
// two decimals so the path strings stay stable.
const formatRailCoordinate = (value: number) => `${Number(value.toFixed(2))}`

export const buildOutlineRail = (
  rows: readonly OutlineRailRow[],
  activeRowIndex: number
): OutlineRailPaths | undefined => {
  const [firstRow] = rows
  const lastRow = rows.at(-1)
  if (!firstRow || !lastRow) {
    return undefined
  }

  const activeRow = rows[activeRowIndex] ?? firstRow
  return {
    activeDash: {
      length: activeRow.bottom - activeRow.top,
      offset: firstRow.top - activeRow.top,
      total: lastRow.bottom - firstRow.top,
    },
    basePath: `M ${formatRailCoordinate(OUTLINE_RAIL_X_PX)} ${formatRailCoordinate(firstRow.top)} L ${formatRailCoordinate(OUTLINE_RAIL_X_PX)} ${formatRailCoordinate(lastRow.bottom)}`,
  }
}
