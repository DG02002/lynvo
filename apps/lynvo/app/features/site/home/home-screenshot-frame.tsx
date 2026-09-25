import type { CSSProperties } from "react"

import screenshotPalettes from "./screenshot-palettes.json"

type HomeScreenshotFrameStyle = CSSProperties &
  Record<`--home-screenshot-${string}`, string>

const desktopPalette = screenshotPalettes["aurora-058"]
const phonePalette = screenshotPalettes["aurora-059"]

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

export const HomeScreenshotFrame = () => {
  const style: HomeScreenshotFrameStyle = {
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
