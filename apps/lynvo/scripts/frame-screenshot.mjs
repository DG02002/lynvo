import { mkdir } from "node:fs/promises"
import path from "node:path"

import sharp from "sharp"

const FRAME_PADDING_CSS = 10
const FRAME_RADIUS_CSS = 14
const SCREEN_RADIUS_CSS = 4

const getFarthestCornerRadius = ({ centerX, centerY, height, width }) =>
  Math.max(
    Math.hypot(centerX, centerY),
    Math.hypot(width - centerX, centerY),
    Math.hypot(centerX, height - centerY),
    Math.hypot(width - centerX, height - centerY)
  )

const getLinearGradientEndpoints = (width, height) => {
  const angle = (135 * Math.PI) / 180
  const directionX = Math.sin(angle)
  const directionY = -Math.cos(angle)
  const halfLength =
    (Math.abs(directionX) * width + Math.abs(directionY) * height) / 2
  const centerX = width / 2
  const centerY = height / 2

  return {
    start: {
      x: centerX - directionX * halfLength,
      y: centerY - directionY * halfLength,
    },
    end: {
      x: centerX + directionX * halfLength,
      y: centerY + directionY * halfLength,
    },
  }
}

const getFrameLayout = (metadata, viewport) => {
  const pixelRatio = viewport.deviceScaleFactor
  if (
    metadata.width !== viewport.width * pixelRatio ||
    metadata.height !== viewport.height * pixelRatio
  ) {
    throw new Error(
      "The screenshot dimensions do not match its manifest viewport."
    )
  }

  const canvasWidth = metadata.width
  const panelWidth = Math.round(
    Math.min(viewport.width * 0.82, 1140) * pixelRatio
  )
  const framePadding = FRAME_PADDING_CSS * pixelRatio
  const screenWidth = panelWidth - framePadding * 2
  const screenHeight = Math.round(
    (metadata.height / metadata.width) * screenWidth
  )
  const panelHeight = screenHeight + framePadding * 2
  const side = Math.round((canvasWidth - panelWidth) / 2)
  const verticalPadding =
    Math.round(Math.min(Math.max(64, viewport.width * 0.1), 144)) * pixelRatio
  const outputHeight = panelHeight + verticalPadding * 2

  return {
    canvasWidth,
    imageX: side + framePadding,
    imageY: verticalPadding + framePadding,
    outputHeight,
    panelHeight,
    panelRadius: FRAME_RADIUS_CSS * pixelRatio,
    panelWidth,
    panelX: side,
    panelY: verticalPadding,
    pixelRatio,
    screenHeight,
    screenRadius: SCREEN_RADIUS_CSS * pixelRatio,
    screenWidth,
  }
}

const svgForBackground = (layout, palette) => {
  const { canvasWidth: width, outputHeight: height } = layout
  const upperRight = { x: width * 0.85, y: height * 0.08 }
  const upperRightRadius = getFarthestCornerRadius({
    centerX: upperRight.x,
    centerY: upperRight.y,
    height,
    width,
  })
  const lowerLeft = { x: width * 0.15, y: height * 0.85 }
  const lowerLeftRadius = getFarthestCornerRadius({
    centerX: lowerLeft.x,
    centerY: lowerLeft.y,
    height,
    width,
  })
  const { start, end } = getLinearGradientEndpoints(width, height)

  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="base" gradientUnits="userSpaceOnUse" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}">
          <stop offset="0%" stop-color="${palette.baseStart}" />
          <stop offset="48%" stop-color="${palette.baseMiddle}" />
          <stop offset="100%" stop-color="${palette.baseEnd}" />
        </linearGradient>
        <radialGradient id="lower-left" gradientUnits="userSpaceOnUse" cx="${lowerLeft.x}" cy="${lowerLeft.y}" r="${lowerLeftRadius}">
          <stop offset="0%" stop-color="${palette.lowerLeft}" />
          <stop offset="52%" stop-color="${palette.lowerLeft}" stop-opacity="0" />
          <stop offset="100%" stop-color="${palette.lowerLeft}" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="upper-right" gradientUnits="userSpaceOnUse" cx="${upperRight.x}" cy="${upperRight.y}" r="${upperRightRadius}">
          <stop offset="0%" stop-color="${palette.upperRight}" />
          <stop offset="42%" stop-color="${palette.upperRight}" stop-opacity="0" />
          <stop offset="100%" stop-color="${palette.upperRight}" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#base)" />
      <rect width="${width}" height="${height}" fill="url(#lower-left)" />
      <rect width="${width}" height="${height}" fill="url(#upper-right)" />
    </svg>
  `)
}

const svgForRoundedMask = (layout) => {
  const { screenHeight, screenRadius, screenWidth } = layout
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${screenWidth}" height="${screenHeight}" viewBox="0 0 ${screenWidth} ${screenHeight}">
      <rect width="${screenWidth}" height="${screenHeight}" rx="${screenRadius}" fill="#fff" />
    </svg>
  `)
}

const svgForPanel = (layout) => {
  const {
    canvasWidth,
    outputHeight,
    panelHeight,
    panelRadius,
    panelWidth,
    panelX,
    panelY,
  } = layout
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${outputHeight}" viewBox="0 0 ${canvasWidth} ${outputHeight}">
      <rect x="${panelX}" y="${panelY}" width="${panelWidth}" height="${panelHeight}" rx="${panelRadius}" fill="#101012" />
    </svg>
  `)
}

const svgForShadow = (options) => {
  const {
    height,
    opacity,
    panelHeight,
    panelWidth,
    radius,
    width,
    x,
    y,
    yOffset,
  } = options
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect x="${x}" y="${y + yOffset}" width="${panelWidth}" height="${panelHeight}" rx="${radius}" fill="#000" fill-opacity="${opacity}" />
    </svg>
  `)
}

const createShadow = async (options, blurRadius) =>
  sharp(svgForShadow(options)).blur(blurRadius).png().toBuffer()

const createShadows = async (layout) => {
  const { canvasWidth, outputHeight, panelHeight, panelRadius, panelWidth } =
    layout
  const { panelX: x, panelY: y, pixelRatio } = layout
  const shadowOptions = (opacity, yOffset) => ({
    height: outputHeight,
    opacity,
    panelHeight,
    panelWidth,
    radius: panelRadius,
    width: canvasWidth,
    x,
    y,
    yOffset: yOffset * pixelRatio,
  })
  return Promise.all([
    createShadow(shadowOptions(0.22, 48), 46 * pixelRatio),
    createShadow(shadowOptions(0.12, 12), 14 * pixelRatio),
  ])
}

const createRoundedCapture = async (capture, layout) => {
  const { screenHeight, screenWidth } = layout
  return sharp(capture)
    .resize(screenWidth, screenHeight)
    .ensureAlpha()
    .composite([{ input: svgForRoundedMask(layout), blend: "dest-in" }])
    .png()
    .toBuffer()
}

const validatePalette = (palette) => {
  for (const color of Object.values(palette)) {
    if (!/^#[\dA-F]{6}$/iu.test(color)) {
      throw new Error(
        `The screenshot palette contains an invalid color: ${color}`
      )
    }
  }
}

export const saveScreenshot = async (capture, outputPath) => {
  await mkdir(path.dirname(outputPath), { recursive: true })
  await sharp(capture)
    .toFormat(path.extname(outputPath).slice(1))
    .toFile(outputPath)
}

export const frameScreenshot = async (
  capture,
  palette,
  { viewport, outputPath }
) => {
  validatePalette(palette)
  const metadata = await sharp(capture).metadata()
  if (!metadata.width || !metadata.height || viewport.deviceScaleFactor <= 0) {
    throw new Error("The screenshot has invalid dimensions or scale factor.")
  }
  const layout = getFrameLayout(metadata, viewport)
  const [background, [wideShadow, nearShadow], roundedCapture] =
    await Promise.all([
      sharp(svgForBackground(layout, palette)).png().toBuffer(),
      createShadows(layout),
      createRoundedCapture(capture, layout),
    ])
  await mkdir(path.dirname(outputPath), { recursive: true })
  await sharp(background)
    .composite([
      { input: wideShadow },
      { input: nearShadow },
      { input: svgForPanel(layout) },
      { input: roundedCapture, left: layout.imageX, top: layout.imageY },
    ])
    .toFormat(path.extname(outputPath).slice(1))
    .toFile(outputPath)
}
