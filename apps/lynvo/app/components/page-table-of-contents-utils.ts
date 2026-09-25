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
  activePath: string
  basePath: string
}

const OUTLINE_RAIL_CORNER_RADIUS_PX = 8

// SVG accepts raw numbers, but measured offsets pick up float noise; trim to
// two decimals so the path strings stay stable.
const formatRailCoordinate = (value: number) => `${Number(value.toFixed(2))}`

const getRailX = (level: 2 | 3, stepPx: number) => (level === 2 ? 0 : stepPx)

// Rounds one polyline corner into a line-to plus quadratic curve pair, with
// the radius clamped so neighboring corners never overlap.
const getCornerCurveParts = (
  previous: readonly [number, number],
  corner: readonly [number, number],
  next: readonly [number, number]
): [string, string] => {
  const [previousX, previousY] = previous
  const [cornerX, cornerY] = corner
  const [nextX, nextY] = next
  const radius = Math.min(
    OUTLINE_RAIL_CORNER_RADIUS_PX,
    Math.hypot(cornerX - previousX, cornerY - previousY) / 2,
    Math.hypot(nextX - cornerX, nextY - cornerY) / 2
  )
  const incomingX = cornerX - previousX
  const incomingY = cornerY - previousY
  const incomingLength = Math.hypot(incomingX, incomingY) || 1
  const outgoingX = nextX - cornerX
  const outgoingY = nextY - cornerY
  const outgoingLength = Math.hypot(outgoingX, outgoingY) || 1
  return [
    `L ${formatRailCoordinate(
      cornerX - (incomingX / incomingLength) * radius
    )} ${formatRailCoordinate(cornerY - (incomingY / incomingLength) * radius)}`,
    `Q ${formatRailCoordinate(cornerX)} ${formatRailCoordinate(cornerY)} ${formatRailCoordinate(
      cornerX + (outgoingX / outgoingLength) * radius
    )} ${formatRailCoordinate(cornerY + (outgoingY / outgoingLength) * radius)}`,
  ]
}

const buildRoundedPath = (points: ReadonlyArray<readonly [number, number]>) => {
  const firstPoint = points.at(0)
  const lastPoint = points.at(-1)
  if (!firstPoint || !lastPoint || points.length < 2) {
    return ""
  }
  const [startX, startY] = firstPoint
  const pathParts = [
    `M ${formatRailCoordinate(startX)} ${formatRailCoordinate(startY)}`,
  ]
  for (let index = 1; index < points.length - 1; index += 1) {
    pathParts.push(
      ...getCornerCurveParts(
        points[index - 1],
        points[index],
        points[index + 1]
      )
    )
  }
  const [endX, endY] = lastPoint
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
      const boundaryY = rows[index].top
      points.push(
        [getRailX(rows[index - 1].level, stepPx), boundaryY],
        [getRailX(rows[index].level, stepPx), boundaryY]
      )
    }
  }
  const lastRow = rows.at(-1)
  if (lastRow !== undefined) {
    points.push([getRailX(lastRow.level, stepPx), lastRow.bottom])
  }
  return points
}

const getActiveRailPoints = (
  rows: readonly OutlineRailRow[],
  activeRowIndex: number,
  stepPx: number
): Array<[number, number]> => {
  const activeRow = rows[activeRowIndex] ?? rows[0]
  const activeX = getRailX(activeRow.level, stepPx)
  const points: Array<[number, number]> = [[activeX, activeRow.top]]
  let activeBottom = activeRow.bottom
  let childStart: number | undefined
  for (
    let index = activeRowIndex + 1;
    index < rows.length && rows[index].level > activeRow.level;
    index += 1
  ) {
    childStart ??= rows[index].top
    activeBottom = rows[index].bottom
  }
  if (childStart !== undefined) {
    points.push(
      [activeX, childStart],
      [getRailX(3, stepPx), childStart],
      [getRailX(3, stepPx), activeBottom],
      [activeX, activeBottom]
    )
  } else {
    points.push([activeX, activeBottom])
  }
  return points
}

/**
 * Builds the table-of-contents rail as SVG paths: one continuous base line
 * that steps sideways with rounded elbows wherever the heading level changes,
 * and one active segment that starts at the active heading, follows its
 * nested children, and returns to the parent indent.
 */
export const buildOutlineRail = (
  rows: readonly OutlineRailRow[],
  activeRowIndex: number,
  stepPx: number
): OutlineRailPaths | undefined => {
  if (rows.length === 0) {
    return undefined
  }
  return {
    activePath: buildRoundedPath(
      getActiveRailPoints(rows, activeRowIndex, stepPx)
    ),
    basePath: buildRoundedPath(getBaseRailPoints(rows, stepPx)),
  }
}
