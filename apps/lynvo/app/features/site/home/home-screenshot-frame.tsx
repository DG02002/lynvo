import type { CSSProperties } from "react"

import screenshotFrameSpec from "./screenshot-frame-spec.json"
import screenshotPalettes from "./screenshot-palettes.json"

type HomeScreenshotFrameStyle = CSSProperties &
  Record<`--home-screenshot-${string}`, string>

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

const createPaletteStyle = (
  prefix: "desktop" | "phone",
  palette: typeof desktopPalette
) => ({
  [`--home-screenshot-${prefix}-upper-right`]: palette.upperRight,
  [`--home-screenshot-${prefix}-lower-left`]: palette.lowerLeft,
  [`--home-screenshot-${prefix}-base-start`]: palette.baseStart,
  [`--home-screenshot-${prefix}-base-middle`]: palette.baseMiddle,
  [`--home-screenshot-${prefix}-base-end`]: palette.baseEnd,
})

const { frame } = screenshotFrameSpec
const { aurora } = screenshotFrameSpec
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
  const style: HomeScreenshotFrameStyle = {
    ...frameStyle,
    ...createPaletteStyle("desktop", desktopPalette),
    ...createPaletteStyle("phone", phonePalette),
  }

  return (
    <section
      aria-label="Lynvo Library preview"
      className="home-screenshot-stage"
      style={style}
    >
      <div className="home-screenshot-frame">
        <img
          alt="Lynvo Library in List view"
          className="home-screenshot-frame__image"
          decoding="async"
          height="1672"
          loading="lazy"
          src="/images/homepage/library-overview.png"
          width="2940"
        />
      </div>
    </section>
  )
}
