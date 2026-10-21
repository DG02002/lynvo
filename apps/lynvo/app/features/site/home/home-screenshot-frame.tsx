import type { CSSVariableStyle } from "~/lib/style"

import screenshotFrameSpec from "./screenshot-frame-spec.json"

type HomeScreenshotFrameStyle = CSSVariableStyle<`--home-screenshot-${string}`>

const { frame } = screenshotFrameSpec
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

const shadowRgb = [1, 3, 5]
  .map((offset) =>
    Number.parseInt(frame.shadowColor.slice(offset, offset + 2), 16)
  )
  .join(", ")
const frameStyle: HomeScreenshotFrameStyle = {
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

export const HomeScreenshotFrame = () => (
  <section
    aria-label="Lynvo Library preview"
    className="home-screenshot-stage"
    style={frameStyle}
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
