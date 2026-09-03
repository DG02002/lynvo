import * as React from "react"
import { encodeQrCode, type QrCodeModules } from "~/lib/qr-code"

type QrCodeProps = Omit<React.SVGProps<SVGSVGElement>, "title"> & {
  readonly value: string
  readonly size?: number
  readonly marginSize?: number
  readonly bgColor?: string
  readonly fgColor?: string
  readonly title?: string
}

const buildQrCodePath = (modules: QrCodeModules, margin: number) => {
  const path: string[] = []

  modules.forEach((row, y) => {
    let x = 0

    while (x < row.length) {
      if (!row[x]) {
        x += 1
        continue
      }

      const start = x
      while (x < row.length && row[x]) {
        x += 1
      }

      path.push(
        `M${start + margin} ${y + margin}h${x - start}v1H${start + margin}z`
      )
    }
  })

  return path.join("")
}

export const QrCode = ({
  value,
  size = 128,
  marginSize = 4,
  bgColor = "#ffffff",
  fgColor = "#000000",
  title,
  ...props
}: QrCodeProps) => {
  if (!Number.isInteger(marginSize) || marginSize < 0) {
    throw new RangeError("QR margin must be a non-negative integer")
  }

  const modules = React.useMemo(() => encodeQrCode(value), [value])
  const moduleCount = modules.length + marginSize * 2
  const foregroundPath = buildQrCodePath(modules, marginSize)

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${moduleCount} ${moduleCount}`}
      role="img"
      aria-label={title ? undefined : "QR code"}
      {...props}
    >
      {title ? <title>{title}</title> : null}
      <path
        fill={bgColor}
        d={`M0 0h${moduleCount}v${moduleCount}H0z`}
        // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- This is the SVG presentation attribute that keeps QR modules crisp.
        shapeRendering="crispEdges"
      />
      <path
        fill={fgColor}
        d={foregroundPath}
        // oxlint-disable-next-line anti-slop/no-shape-in-symbol-names -- This is the SVG presentation attribute that keeps QR modules crisp.
        shapeRendering="crispEdges"
      />
    </svg>
  )
}
