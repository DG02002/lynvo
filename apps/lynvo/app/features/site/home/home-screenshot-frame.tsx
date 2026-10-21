import { useSyncExternalStore } from "react"

import type { CSSVariableStyle } from "~/lib/style"

import screenshotFrameSpec from "./screenshot-frame-spec.json"
import screenshotPalettes from "./screenshot-palettes.json"

type HomeScreenshotFrameStyle = CSSVariableStyle<`--home-screenshot-${string}`>

const getScreenshotPalette = (theme: string) => {
  const entry = Object.entries(screenshotPalettes).find(
    ([name]) => name === theme
  )
  if (!entry) {
    throw new Error(`The homepage frame uses an unknown palette: ${theme}.`)
  }
  return entry[1]
}

const desktopPalette = getScreenshotPalette(
  screenshotFrameSpec.homeThemes.desktop
)
const phonePalette = getScreenshotPalette(screenshotFrameSpec.homeThemes.phone)

// Written out per palette instead of built by a helper: the design-system
// lint can only verify style objects whose custom-property keys are static.
const desktopPaletteStyle: HomeScreenshotFrameStyle = {
  "--home-screenshot-desktop-upper-right": desktopPalette.upperRight,
  "--home-screenshot-desktop-lower-left": desktopPalette.lowerLeft,
  "--home-screenshot-desktop-base-start": desktopPalette.baseStart,
  "--home-screenshot-desktop-base-middle": desktopPalette.baseMiddle,
  "--home-screenshot-desktop-base-end": desktopPalette.baseEnd,
}

const phonePaletteStyle: HomeScreenshotFrameStyle = {
  "--home-screenshot-phone-upper-right": phonePalette.upperRight,
  "--home-screenshot-phone-lower-left": phonePalette.lowerLeft,
  "--home-screenshot-phone-base-start": phonePalette.baseStart,
  "--home-screenshot-phone-base-middle": phonePalette.baseMiddle,
  "--home-screenshot-phone-base-end": phonePalette.baseEnd,
}

const { frame } = screenshotFrameSpec
const { aurora } = screenshotFrameSpec
const homepageImagePath = "/images/homepage/library-overview"
const homepageImageSourceSet = [
  ...screenshotFrameSpec.responsiveImageWidths.map(
    (width) => `${homepageImagePath}-${width}.webp ${width}w`
  ),
  `${homepageImagePath}.webp 2940w`,
].join(", ")
const imagePadding = frame.paddingCssPixels * 2
const homepageImageSizes = [
  `(max-width: ${frame.phoneViewportMaxWidthCssPixels}px) calc(${frame.phoneWidthViewportPercent}vw - ${imagePadding}px)`,
  `min(calc(${frame.widthViewportPercent}vw - ${imagePadding}px), ${frame.maxWidthCssPixels - imagePadding}px)`,
].join(", ")
const phoneViewportQuery = `(max-width: ${frame.phoneViewportMaxWidthCssPixels}px)`
const subscribeToPhoneViewport = (onChange: () => void) => {
  const query = window.matchMedia(phoneViewportQuery)
  query.addEventListener("change", onChange)
  return () => query.removeEventListener("change", onChange)
}
const getIsPhoneViewport = () => window.matchMedia(phoneViewportQuery).matches

const shadowRgb = [1, 3, 5]
  .map((offset) =>
    Number.parseInt(frame.shadowColor.slice(offset, offset + 2), 16)
  )
  .join(", ")
const frameStyle: HomeScreenshotFrameStyle = {
  "--home-screenshot-upper-right-position": `${aurora.upperRight.xPercent}% ${aurora.upperRight.yPercent}%`,
  "--home-screenshot-upper-right-fade": `${aurora.upperRight.fadePercent}%`,
  "--home-screenshot-lower-left-position": `${aurora.lowerLeft.xPercent}% ${aurora.lowerLeft.yPercent}%`,
  "--home-screenshot-lower-left-fade": `${aurora.lowerLeft.fadePercent}%`,
  "--home-screenshot-linear-angle": `${aurora.linearAngleDegrees}deg`,
  "--home-screenshot-linear-middle-stop": `${aurora.linearMiddleStopPercent}%`,
  "--home-screenshot-desktop-frame-width": `${frame.widthViewportPercent}vw`,
  "--home-screenshot-frame-max-width": `${frame.maxWidthCssPixels}px`,
  "--home-screenshot-phone-frame-width": `${frame.phoneWidthViewportPercent}vw`,
  "--home-screenshot-frame-padding": `${frame.paddingCssPixels}px`,
  "--home-screenshot-frame-radius": `${frame.radiusCssPixels}px`,
  "--home-screenshot-screen-radius": `${frame.screenRadiusCssPixels}px`,
  "--home-screenshot-frame-color": frame.color,
  "--home-screenshot-frame-shadow": frame.shadows
    .map(
      (shadow) =>
        `${shadow.offsetXCssPixels}px ${shadow.offsetYCssPixels}px ${shadow.blurCssPixels}px rgba(${shadowRgb}, ${shadow.opacity})`
    )
    .join(", "),
}

export const HomeScreenshotFrame = () => {
  const isPhoneViewport = useSyncExternalStore(
    subscribeToPhoneViewport,
    getIsPhoneViewport,
    () => false
  )
  const style: HomeScreenshotFrameStyle = {
    ...frameStyle,
    ...desktopPaletteStyle,
    ...phonePaletteStyle,
  }

  return (
    <section
      aria-label="Lynvo Library preview"
      className="home-screenshot-stage"
      data-phone-viewport={isPhoneViewport ? "true" : undefined}
      style={style}
    >
      <div className="home-screenshot-frame">
        <img
          alt="Lynvo Library in Gallery view"
          className="home-screenshot-frame__image"
          decoding="async"
          height="1672"
          loading="lazy"
          sizes={homepageImageSizes}
          src={`${homepageImagePath}.webp`}
          srcSet={homepageImageSourceSet}
          width="2940"
        />
      </div>
    </section>
  )
}
