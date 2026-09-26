import { mkdir } from "node:fs/promises"
import path from "node:path"

import sharp from "sharp"

import screenshotFrameSpec from "../app/features/site/home/screenshot-frame-spec.json" with { type: "json" }

const { aurora, docsCanvas, frame } = screenshotFrameSpec

const getFarthestCornerRadius = ({ centerX, centerY, height, width }) =>
  Math.max(
    Math.hypot(centerX, centerY),
    Math.hypot(width - centerX, centerY),
    Math.hypot(centerX, height - centerY),
    Math.hypot(width - centerX, height - centerY)
  )

const getLinearGradientEndpoints = (width, height, angleDegrees) => {
  const angle = (angleDegrees * Math.PI) / 180
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

const getViewportCaptureMetadata = (metadata, viewport) => {
  const pixelRatio = viewport.deviceScaleFactor
  if (
    !metadata.width ||
    !metadata.height ||
    pixelRatio <= 0 ||
    metadata.width !== viewport.width * pixelRatio ||
    metadata.height !== viewport.height * pixelRatio
  ) {
    throw new Error(
      "The screenshot dimensions do not match its manifest viewport."
    )
  }
  return pixelRatio
}

const getFrameLayout = (metadata, viewport) => {
  const pixelRatio = getViewportCaptureMetadata(metadata, viewport)

  const canvasWidth = metadata.width
  const frameWidthPercent =
    viewport.width <= frame.phoneViewportMaxWidthCssPixels
      ? frame.phoneWidthViewportPercent
      : frame.widthViewportPercent
  const frameWidthCss = Math.min(
    viewport.width * (frameWidthPercent / 100),
    frame.maxWidthCssPixels
  )
  const panelWidth = Math.round(frameWidthCss * pixelRatio)
  const framePadding = frame.paddingCssPixels * pixelRatio
  const screenWidth = panelWidth - framePadding * 2
  const screenHeight = Math.round(
    (metadata.height / metadata.width) * screenWidth
  )
  const panelHeight = screenHeight + framePadding * 2
  const side = Math.round((canvasWidth - panelWidth) / 2)
  const verticalPadding = side
  const outputHeight = panelHeight + verticalPadding * 2

  return {
    canvasWidth,
    imageX: side + framePadding,
    imageY: verticalPadding + framePadding,
    outputHeight,
    panelHeight,
    panelRadius: frame.radiusCssPixels * pixelRatio,
    panelWidth,
    panelX: side,
    panelY: verticalPadding,
    pixelRatio,
    screenHeight,
    screenRadius: frame.screenRadiusCssPixels * pixelRatio,
    screenWidth,
  }
}

// Documentation screenshots share one fixed canvas so every image in a page
// renders at the same size. The capture is contain-fit and centered; the
// aurora background fills whatever space the capture cannot occupy.
const getDocsCanvasLayout = (metadata, viewport) => {
  const pixelRatio = getViewportCaptureMetadata(metadata, viewport)
  const canvasWidth = Math.round(docsCanvas.widthCssPixels * pixelRatio)
  const canvasHeight = Math.round(docsCanvas.heightCssPixels * pixelRatio)
  const framePadding = frame.paddingCssPixels * pixelRatio
  const panelMargin = docsCanvas.panelMarginCssPixels * pixelRatio
  const maxScreenWidth = canvasWidth - panelMargin * 2 - framePadding * 2
  const maxScreenHeight = canvasHeight - panelMargin * 2 - framePadding * 2
  const scale = Math.min(
    maxScreenWidth / metadata.width,
    maxScreenHeight / metadata.height
  )
  const screenWidth = Math.round(metadata.width * scale)
  const screenHeight = Math.round(metadata.height * scale)
  const panelWidth = screenWidth + framePadding * 2
  const panelHeight = screenHeight + framePadding * 2

  return {
    canvasWidth,
    imageX: Math.round((canvasWidth - screenWidth) / 2),
    imageY: Math.round((canvasHeight - screenHeight) / 2),
    outputHeight: canvasHeight,
    panelHeight,
    panelRadius: frame.radiusCssPixels * pixelRatio,
    panelWidth,
    panelX: Math.round((canvasWidth - panelWidth) / 2),
    panelY: Math.round((canvasHeight - panelHeight) / 2),
    pixelRatio,
    screenHeight,
    screenRadius: frame.screenRadiusCssPixels * pixelRatio,
    screenWidth,
  }
}

const svgForBackground = (layout, palette) => {
  const { canvasWidth: width, outputHeight: height } = layout
  const upperRight = {
    x: width * (aurora.upperRight.xPercent / 100),
    y: height * (aurora.upperRight.yPercent / 100),
  }
  const upperRightRadius = getFarthestCornerRadius({
    centerX: upperRight.x,
    centerY: upperRight.y,
    height,
    width,
  })
  const lowerLeft = {
    x: width * (aurora.lowerLeft.xPercent / 100),
    y: height * (aurora.lowerLeft.yPercent / 100),
  }
  const lowerLeftRadius = getFarthestCornerRadius({
    centerX: lowerLeft.x,
    centerY: lowerLeft.y,
    height,
    width,
  })
  const { start, end } = getLinearGradientEndpoints(
    width,
    height,
    aurora.linearAngleDegrees
  )

  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="base" gradientUnits="userSpaceOnUse" x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}">
          <stop offset="0%" stop-color="${palette.baseStart}" />
          <stop offset="${aurora.linearMiddleStopPercent}%" stop-color="${palette.baseMiddle}" />
          <stop offset="100%" stop-color="${palette.baseEnd}" />
        </linearGradient>
        <radialGradient id="lower-left" gradientUnits="userSpaceOnUse" cx="${lowerLeft.x}" cy="${lowerLeft.y}" r="${lowerLeftRadius}">
          <stop offset="0%" stop-color="${palette.lowerLeft}" />
          <stop offset="${aurora.lowerLeft.fadePercent}%" stop-color="${palette.lowerLeft}" stop-opacity="0" />
          <stop offset="100%" stop-color="${palette.lowerLeft}" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="upper-right" gradientUnits="userSpaceOnUse" cx="${upperRight.x}" cy="${upperRight.y}" r="${upperRightRadius}">
          <stop offset="0%" stop-color="${palette.upperRight}" />
          <stop offset="${aurora.upperRight.fadePercent}%" stop-color="${palette.upperRight}" stop-opacity="0" />
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
        <rect x="${panelX}" y="${panelY}" width="${panelWidth}" height="${panelHeight}" rx="${panelRadius}" fill="${frame.color}" />
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
      <rect x="${x}" y="${y + yOffset}" width="${panelWidth}" height="${panelHeight}" rx="${radius}" fill="${frame.shadowColor}" fill-opacity="${opacity}" />
    </svg>
  `)
}

const createShadow = async (options, blurRadius) =>
  sharp(svgForShadow(options)).blur(blurRadius).png().toBuffer()

const createShadows = async (layout) => {
  const { canvasWidth, outputHeight, panelHeight, panelRadius, panelWidth } =
    layout
  const { panelX, panelY, pixelRatio } = layout
  const shadowOptions = (shadow) => ({
    height: outputHeight,
    opacity: shadow.opacity,
    panelHeight,
    panelWidth,
    radius: panelRadius,
    width: canvasWidth,
    x: panelX + shadow.offsetXCssPixels * pixelRatio,
    y: panelY,
    yOffset: shadow.offsetYCssPixels * pixelRatio,
  })
  return Promise.all(
    frame.shadows.map((shadow) =>
      createShadow(
        shadowOptions(shadow),
        (shadow.blurCssPixels / 2) * pixelRatio
      )
    )
  )
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

const writeScreenshot = async (image, outputPath) => {
  const formattedImage =
    path.extname(outputPath) === ".webp"
      ? image.webp({ effort: 6, quality: 95, smartSubsample: true })
      : image.png({
          adaptiveFiltering: true,
          compressionLevel: 9,
          effort: 10,
        })
  await mkdir(path.dirname(outputPath), { recursive: true })
  await formattedImage.toFile(outputPath)
}

export const validatePalette = (palette, label = "The screenshot palette") => {
  for (const color of Object.values(palette)) {
    if (!/^#[\dA-F]{6}$/iu.test(color)) {
      throw new Error(`${label} contains an invalid color: ${color}`)
    }
  }
}

export const saveScreenshot = async (capture, outputPath) => {
  await writeScreenshot(sharp(capture), outputPath)
}

const renderFramedScreenshot = async ({
  capture,
  layout,
  outputPath,
  palette,
}) => {
  validatePalette(palette)
  const [background, shadows, roundedCapture] = await Promise.all([
    sharp(svgForBackground(layout, palette)).png().toBuffer(),
    createShadows(layout),
    createRoundedCapture(capture, layout),
  ])
  await writeScreenshot(
    sharp(background).composite([
      ...shadows.map((input) => ({ input })),
      { input: svgForPanel(layout) },
      { input: roundedCapture, left: layout.imageX, top: layout.imageY },
    ]),
    outputPath
  )
}

export const frameScreenshot = async (
  capture,
  palette,
  { viewport, outputPath }
) => {
  const metadata = await sharp(capture).metadata()
  const layout = getFrameLayout(metadata, viewport)
  await renderFramedScreenshot({ capture, layout, outputPath, palette })
}

export const frameDocsScreenshot = async (
  capture,
  palette,
  { viewport, outputPath }
) => {
  const metadata = await sharp(capture).metadata()
  const layout = getDocsCanvasLayout(metadata, viewport)
  await renderFramedScreenshot({ capture, layout, outputPath, palette })
}
