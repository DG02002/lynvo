import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react"
import { createPortal } from "react-dom"

import { cn } from "~/lib/utils"

// Port of the Linear docs image viewer, measured from linear.app/docs. The
// clone keeps the thumbnail's exact rect and a single transform moves it to a
// centered viewport fit, which keeps the image spatially attached throughout
// the animation. Motion's 400ms, bounce=0 spring is represented by the same
// piecewise-linear easing string the reference emits for the Web Animations
// API. The animation's finished promise owns teardown so an interrupted close
// cannot reveal the thumbnail before the clone reaches it.
const DOCS_SCREENSHOT_ZOOM_GUTTER_PX = 24
const DOCS_SCREENSHOT_ZOOM_DURATION_MS = 400
const DOCS_SCREENSHOT_ZOOM_SPRING_EASING =
  "linear(0, 0.1803, 0.4551, 0.6711, 0.8122, 0.8966, 0.9445, 0.9708, 0.9848, 0.9922, 0.996, 0.998, 1)"

interface ZoomPose {
  borderRadius: number
  borderWidth: number
  collapsedTransform: string
  expandedTransform: string
  height: number
  left: number
  top: number
  width: number
}

const getExpandedTransform = ({
  thumbnail,
  viewportHeight,
  viewportWidth,
}: {
  thumbnail: Pick<DOMRect, "height" | "left" | "top" | "width">
  viewportHeight: number
  viewportWidth: number
}) => {
  const fitScale = Math.min(
    (viewportWidth - DOCS_SCREENSHOT_ZOOM_GUTTER_PX * 2) / thumbnail.width,
    (viewportHeight - DOCS_SCREENSHOT_ZOOM_GUTTER_PX * 2) / thumbnail.height
  )
  const translateX =
    (viewportWidth / 2 - (thumbnail.left + thumbnail.width / 2)) / fitScale
  const translateY =
    (viewportHeight / 2 - (thumbnail.top + thumbnail.height / 2)) / fitScale

  return `scale(${fitScale}) translate(${translateX}px, ${translateY}px)`
}

const getZoomPose = ({
  thumbnail,
  thumbnailBorderRadius,
  thumbnailBorderWidth,
  viewportHeight,
  viewportWidth,
}: {
  thumbnail: DOMRect
  thumbnailBorderRadius: number
  thumbnailBorderWidth: number
  viewportHeight: number
  viewportWidth: number
}): ZoomPose | undefined => {
  if (thumbnail.width <= 0 || thumbnail.height <= 0) {
    return undefined
  }

  return {
    borderRadius: thumbnailBorderRadius,
    borderWidth: thumbnailBorderWidth,
    collapsedTransform: "scale(1) translate(0px, 0px)",
    expandedTransform: getExpandedTransform({
      thumbnail,
      viewportHeight,
      viewportWidth,
    }),
    height: thumbnail.height,
    left: thumbnail.left,
    top: thumbnail.top,
    width: thumbnail.width,
  }
}

const applyZoomPose = (
  zoomedImage: HTMLButtonElement,
  pose: ZoomPose,
  transform: string
) => {
  zoomedImage.style.top = `${pose.top}px`
  zoomedImage.style.left = `${pose.left}px`
  zoomedImage.style.width = `${pose.width}px`
  zoomedImage.style.height = `${pose.height}px`
  zoomedImage.style.borderWidth = `${pose.borderWidth}px`
  zoomedImage.style.borderRadius = `${pose.borderRadius}px`
  zoomedImage.style.transform = transform
}

const measureZoomPose = (
  thumbnail: HTMLButtonElement | null
): ZoomPose | undefined => {
  if (!thumbnail) {
    return undefined
  }
  const style = getComputedStyle(thumbnail)
  return getZoomPose({
    thumbnail: thumbnail.getBoundingClientRect(),
    thumbnailBorderRadius: Number.parseFloat(style.borderTopLeftRadius) || 0,
    thumbnailBorderWidth: Number.parseFloat(style.borderTopWidth) || 0,
    viewportHeight: window.innerHeight,
    viewportWidth: window.innerWidth,
  })
}

const getCollapseTransform = ({
  basePose,
  thumbnail,
}: {
  basePose: ZoomPose
  thumbnail: DOMRect
}) => {
  const scale = thumbnail.width / basePose.width
  const baseCenterX = basePose.left + basePose.width / 2
  const baseCenterY = basePose.top + basePose.height / 2
  const thumbnailCenterX = thumbnail.left + thumbnail.width / 2
  const thumbnailCenterY = thumbnail.top + thumbnail.height / 2
  const translateX = (thumbnailCenterX - baseCenterX) / scale
  const translateY = (thumbnailCenterY - baseCenterY) / scale

  return `scale(${scale}) translate(${translateX}px, ${translateY}px)`
}

const getCurrentTransform = (
  zoomedImage: HTMLButtonElement,
  fallbackTransform: string
) => {
  const { transform } = getComputedStyle(zoomedImage)
  if (transform === "none") {
    return fallbackTransform
  }

  const matrixMatch = transform.match(/^matrix\(([-\d.e\s,]+)\)$/u)
  if (!matrixMatch) {
    return transform
  }

  const [, matrixValues] = matrixMatch
  const [scale, , , , translateX, translateY] = matrixValues
    .split(",")
    .map((value) => Number(value.trim()))
  if (
    !Number.isFinite(scale) ||
    scale === 0 ||
    !Number.isFinite(translateX) ||
    !Number.isFinite(translateY)
  ) {
    return transform
  }

  return `scale(${scale}) translate(${translateX / scale}px, ${translateY / scale}px)`
}

const cancelAnimation = (animation: Animation | undefined) => {
  animation?.cancel()
}

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false

const animateStyle = ({
  element,
  from,
  onFinish,
  property,
  to,
}: {
  element: HTMLElement
  from: string
  onFinish?: (animation: Animation | undefined) => void
  property: "opacity" | "transform"
  to: string
}): Animation | undefined => {
  element.style[property] = from
  if (prefersReducedMotion()) {
    element.style[property] = to
    onFinish?.(undefined)
    return undefined
  }

  const isOverlay = property === "opacity"
  let animation: Animation
  try {
    animation = element.animate([{ [property]: from }, { [property]: to }], {
      duration: isOverlay ? 250 : DOCS_SCREENSHOT_ZOOM_DURATION_MS,
      easing: isOverlay
        ? "cubic-bezier(0, 0, 0.58, 1)"
        : DOCS_SCREENSHOT_ZOOM_SPRING_EASING,
      fill: "both",
    })
  } catch {
    // Browsers without WAAPI or with unsupported easing still reach the final pose.
    element.style[property] = to
    onFinish?.(undefined)
    return undefined
  }
  if (onFinish) {
    // Cancelling a retargeted animation rejects `finished` by design.
    void animation.finished.then(
      () => onFinish(animation),
      () => undefined
    )
  }
  return animation
}

interface CollapseState {
  collapsedTransform: string
  currentOpacity: string
  currentTransform: string
}

const getCollapseState = ({
  basePose,
  phase,
  thumbnail,
  overlay,
  zoomedImage,
}: {
  basePose: ZoomPose | undefined
  phase: "preparing" | "expanded" | "closing"
  thumbnail: HTMLButtonElement | null
  overlay: HTMLDivElement | null
  zoomedImage: HTMLButtonElement | null
}): CollapseState | undefined => {
  if (!thumbnail || !zoomedImage) {
    return undefined
  }
  const pose = measureZoomPose(thumbnail)
  const resolvedBasePose = basePose ?? pose
  if (!pose || !resolvedBasePose) {
    return undefined
  }
  const collapsedTransform = getCollapseTransform({
    basePose: resolvedBasePose,
    thumbnail: thumbnail.getBoundingClientRect(),
  })
  const currentOpacity = overlay ? getComputedStyle(overlay).opacity : "0"
  const currentTransform = getCurrentTransform(
    zoomedImage,
    phase === "expanded"
      ? resolvedBasePose.expandedTransform
      : collapsedTransform
  )
  return { collapsedTransform, currentOpacity, currentTransform }
}

// The viewer mounts only from a click, never during server rendering, so its
// layout effect can commit the source pose before the first paint.
function DocsScreenshotZoom({
  alt,
  imageSource,
  thumbnailRef,
  onClose,
}: {
  alt: string
  imageSource: string
  thumbnailRef: RefObject<HTMLButtonElement | null>
  onClose: () => void
}) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const zoomedImageRef = useRef<HTMLButtonElement>(null)
  const imageAnimationRef = useRef<Animation | undefined>(undefined)
  const overlayAnimationRef = useRef<Animation | undefined>(undefined)
  const basePoseRef = useRef<ZoomPose | undefined>(undefined)
  const animationGenerationRef = useRef(0)
  const closeGenerationRef = useRef(0)
  const closingRef = useRef(false)
  const phaseRef = useRef<"preparing" | "expanded" | "closing">("preparing")
  const restoredFocusRef = useRef<HTMLElement | null>(null)

  const finishClose = useCallback(() => {
    const thumbnail = thumbnailRef.current
    if (thumbnail) {
      thumbnail.style.visibility = ""
    }
    onClose()
  }, [onClose, thumbnailRef])

  const startCollapse = useCallback(() => {
    const zoomedImage = zoomedImageRef.current
    const overlay = overlayRef.current
    const collapseState = getCollapseState({
      basePose: basePoseRef.current,
      phase: phaseRef.current,
      thumbnail: thumbnailRef.current,
      overlay,
      zoomedImage,
    })
    if (!zoomedImage || !collapseState) {
      finishClose()
      return
    }

    cancelAnimation(imageAnimationRef.current)
    cancelAnimation(overlayAnimationRef.current)
    animationGenerationRef.current += 1
    zoomedImage.style.willChange = "transform"
    phaseRef.current = "closing"
    zoomedImage.dataset.phase = "collapse"
    const closeGeneration = closeGenerationRef.current + 1
    closeGenerationRef.current = closeGeneration
    const closeFinished = () => {
      if (closeGeneration === closeGenerationRef.current) {
        zoomedImage.style.transform = collapseState.collapsedTransform
        cancelAnimation(imageAnimationRef.current)
        finishClose()
      }
    }
    imageAnimationRef.current = animateStyle({
      element: zoomedImage,
      from: collapseState.currentTransform,
      onFinish: closeFinished,
      property: "transform",
      to: collapseState.collapsedTransform,
    })
    if (overlay) {
      overlayAnimationRef.current = animateStyle({
        element: overlay,
        from: collapseState.currentOpacity,
        property: "opacity",
        to: "0",
      })
    }
  }, [finishClose, thumbnailRef])

  const collapse = useCallback(() => {
    if (closingRef.current) {
      return
    }
    closingRef.current = true
    if (phaseRef.current === "preparing") {
      finishClose()
      return
    }
    startCollapse()
  }, [finishClose, startCollapse])

  useLayoutEffect(() => {
    const zoomedImage = zoomedImageRef.current
    const lightboxImage = zoomedImage?.querySelector("img")
    const thumbnail = thumbnailRef.current
    const pose = measureZoomPose(thumbnail)
    let disposed = false
    restoredFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : thumbnail
    zoomedImage?.focus({ preventScroll: true })
    if (!zoomedImage || !pose) {
      return () => {
        disposed = true
      }
    }

    basePoseRef.current = pose
    applyZoomPose(zoomedImage, pose, pose.collapsedTransform)
    const expand = () => {
      if (disposed || closingRef.current) {
        return
      }
      const expansionPose = basePoseRef.current ?? pose
      phaseRef.current = "expanded"
      zoomedImage.dataset.phase = "expand"
      if (thumbnail) {
        thumbnail.style.visibility = "hidden"
      }
      const animationGeneration = animationGenerationRef.current + 1
      animationGenerationRef.current = animationGeneration
      const imageAnimation = animateStyle({
        element: zoomedImage,
        from: expansionPose.collapsedTransform,
        onFinish: (animation) => {
          if (
            disposed ||
            closingRef.current ||
            phaseRef.current !== "expanded" ||
            animationGeneration !== animationGenerationRef.current
          ) {
            return
          }
          zoomedImage.style.transform = expansionPose.expandedTransform
          cancelAnimation(animation)
          zoomedImage.style.willChange = "auto"
        },
        property: "transform",
        to: expansionPose.expandedTransform,
      })
      imageAnimationRef.current = imageAnimation
      if (overlayRef.current) {
        overlayAnimationRef.current = animateStyle({
          element: overlayRef.current,
          from: "0",
          property: "opacity",
          to: "1",
        })
      }
    }

    if (lightboxImage instanceof HTMLImageElement) {
      // Decoding improves the opening transition, but a decode failure must not block the viewer.
      try {
        void lightboxImage.decode().then(expand, expand)
      } catch {
        expand()
      }
    } else {
      expand()
    }
    return () => {
      disposed = true
    }
  }, [thumbnailRef])

  useEffect(
    () => () => {
      cancelAnimation(imageAnimationRef.current)
      cancelAnimation(overlayAnimationRef.current)
      if (thumbnailRef.current) {
        thumbnailRef.current.style.visibility = ""
      }
      restoredFocusRef.current?.focus({ preventScroll: true })
    },
    [thumbnailRef]
  )

  useEffect(() => {
    const handleResize = () => {
      const zoomedImage = zoomedImageRef.current
      const pose = measureZoomPose(thumbnailRef.current)
      if (!zoomedImage || !pose) {
        return
      }
      if (phaseRef.current === "expanded") {
        const basePose = basePoseRef.current ?? pose
        cancelAnimation(imageAnimationRef.current)
        animationGenerationRef.current += 1
        const resizedPose = {
          ...basePose,
          expandedTransform: getExpandedTransform({
            thumbnail: basePose,
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth,
          }),
        }
        basePoseRef.current = resizedPose
        applyZoomPose(zoomedImage, resizedPose, resizedPose.expandedTransform)
        zoomedImage.style.willChange = "auto"
      } else if (phaseRef.current === "preparing") {
        basePoseRef.current = pose
        applyZoomPose(zoomedImage, pose, pose.collapsedTransform)
      } else {
        startCollapse()
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        collapse()
      } else if (event.key === "Tab") {
        event.preventDefault()
        zoomedImageRef.current?.focus({ preventScroll: true })
      }
    }
    const handleScroll = () => {
      if (closingRef.current) {
        startCollapse()
      } else {
        collapse()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("scroll", handleScroll, { passive: true })
    window.addEventListener("resize", handleResize, { passive: true })
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("scroll", handleScroll)
      window.removeEventListener("resize", handleResize)
    }
  }, [collapse, startCollapse, thumbnailRef])

  return createPortal(
    <>
      <div
        ref={overlayRef}
        aria-hidden="true"
        className="docs-screenshot-zoom__overlay"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={alt}
        className="docs-screenshot-zoom__stage"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            collapse()
          }
        }}
      >
        <button
          ref={zoomedImageRef}
          type="button"
          aria-label={`Close image: ${alt}`}
          className="docs-screenshot-zoom__image outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          data-phase="prepare"
          onClick={(event) => {
            event.stopPropagation()
            collapse()
          }}
        >
          <img src={imageSource} alt={alt} />
        </button>
      </div>
    </>,
    document.body
  )
}

export function DocsZoomableFigure({
  alt,
  className,
  source,
}: {
  alt: string
  className?: string
  source: string
}) {
  const thumbnailRef = useRef<HTMLButtonElement>(null)
  const [zoomOpen, setZoomOpen] = useState(false)

  return (
    <figure className={cn("not-typeset my-10", className)}>
      <button
        ref={thumbnailRef}
        type="button"
        onClick={() => setZoomOpen(true)}
        aria-label={`Open image: ${alt}`}
        aria-expanded={zoomOpen}
        className="mx-auto block w-full cursor-zoom-in overflow-hidden rounded-md border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {/* Framed captures share one canvas per set, so full-width
            rendering keeps every figure in a set the same size. */}
        <img
          src={source}
          alt={alt}
          loading="lazy"
          className="h-auto w-full object-cover"
        />
      </button>

      {zoomOpen && (
        <DocsScreenshotZoom
          alt={alt}
          imageSource={source}
          thumbnailRef={thumbnailRef}
          onClose={() => setZoomOpen(false)}
        />
      )}
    </figure>
  )
}
