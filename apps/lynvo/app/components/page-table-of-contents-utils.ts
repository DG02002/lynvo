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
  level: 2 | 3
  top: number
}

export interface OutlineRailPaths {
  activeSegment: { top: number; bottom: number }
  basePath: string
}

// SVG accepts raw numbers, but measured offsets pick up float noise; trim to
// two decimals so the path strings stay stable.
const formatRailCoordinate = (value: number) => `${Number(value.toFixed(2))}`

const getRailX = (level: 2 | 3, stepPx: number) => (level === 2 ? 0 : stepPx)
const OUTLINE_RAIL_CORNER_RADIUS_PX = 4

const getCornerParts = (
  previous: readonly [number, number],
  corner: readonly [number, number],
  next: readonly [number, number]
): string[] => {
  const [previousX, previousY] = previous
  const [cornerX, cornerY] = corner
  const [nextX, nextY] = next
  const incomingX = cornerX - previousX
  const incomingY = cornerY - previousY
  const outgoingX = nextX - cornerX
  const outgoingY = nextY - cornerY
  const incomingLength = Math.hypot(incomingX, incomingY)
  const outgoingLength = Math.hypot(outgoingX, outgoingY)
  const radius = Math.min(
    OUTLINE_RAIL_CORNER_RADIUS_PX,
    incomingLength / 2,
    outgoingLength / 2
  )
  if (radius === 0) {
    return [
      `L ${formatRailCoordinate(cornerX)} ${formatRailCoordinate(cornerY)}`,
    ]
  }
  return [
    `L ${formatRailCoordinate(cornerX - (incomingX / incomingLength) * radius)} ${formatRailCoordinate(cornerY - (incomingY / incomingLength) * radius)}`,
    `Q ${formatRailCoordinate(cornerX)} ${formatRailCoordinate(cornerY)} ${formatRailCoordinate(cornerX + (outgoingX / outgoingLength) * radius)} ${formatRailCoordinate(cornerY + (outgoingY / outgoingLength) * radius)}`,
  ]
}

const buildRailPath = (points: ReadonlyArray<readonly [number, number]>) => {
  const firstPoint = points.at(0)
  if (!firstPoint || points.length < 2) {
    return ""
  }
  const [startX, startY] = firstPoint
  const pathParts = [
    `M ${formatRailCoordinate(startX)} ${formatRailCoordinate(startY)}`,
  ]
  for (let index = 1; index < points.length - 1; index += 1) {
    pathParts.push(
      ...getCornerParts(points[index - 1], points[index], points[index + 1])
    )
  }
  const [endX, endY] = points.at(-1)!
  pathParts.push(
    `L ${formatRailCoordinate(endX)} ${formatRailCoordinate(endY)}`
  )
  return pathParts.join(" ")
}

const getBaseRailPoints = (
  rows: readonly OutlineRailRow[],
  stepPx: number
): Array<[number, number]> => {
  const points: Array<[number, number]> = [
    [getRailX(rows[0].level, stepPx), rows[0].top],
  ]
  for (let index = 1; index < rows.length; index += 1) {
    if (rows[index].level !== rows[index - 1].level) {
      const previousBottom = rows[index - 1].bottom
      const nextTop = rows[index].top
      const cornerInset = Math.min(
        OUTLINE_RAIL_CORNER_RADIUS_PX,
        Math.max(0, nextTop - previousBottom) / 2
      )
      points.push(
        [getRailX(rows[index - 1].level, stepPx), previousBottom + cornerInset],
        [getRailX(rows[index].level, stepPx), nextTop - cornerInset]
      )
    }
  }
  const lastRow = rows.at(-1)
  if (lastRow !== undefined) {
    points.push([getRailX(lastRow.level, stepPx), lastRow.bottom])
  }
  return points
}

export const buildOutlineRail = (
  rows: readonly OutlineRailRow[],
  activeRowIndex: number,
  stepPx: number
): OutlineRailPaths | undefined => {
  if (rows.length === 0) {
    return undefined
  }
  const activeRow = rows[activeRowIndex] ?? rows[0]
  return {
    activeSegment: {
      top: activeRow.top,
      bottom: activeRow.bottom,
    },
    basePath: buildRailPath(getBaseRailPoints(rows, stepPx)),
  }
}
