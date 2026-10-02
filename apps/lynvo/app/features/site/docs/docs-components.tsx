import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion"
import {
  ApiIcon,
  ArrowDown01Icon,
  ArrowUpRight01Icon,
  CopyIcon,
  FileEmpty01Icon,
  Link02Icon,
  StarsIcon,
  TerminalIcon,
  Tick02Icon,
  WifiError01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Result, Schema } from "effect"
import type { MDXComponents } from "mdx/types.js"
import {
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type ReactNode,
  type RefObject,
} from "react"
import { createPortal } from "react-dom"
import { Link } from "react-router"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "~/components/ui/accordion"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { cn } from "~/lib/utils"

import { getDocumentationImageAsset } from "./docs-image-assets"

const copyWithTextArea = (code: string) => {
  const textArea = document.createElement("textarea")
  textArea.value = code
  textArea.style.cssText = "position:fixed;left:-9999px;top:0"
  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()
  const didCopy = document.execCommand("copy")
  textArea.remove()

  if (!didCopy) {
    throw new Error("Clipboard copy failed")
  }
}

const TypeScriptIcon = () => (
  <svg aria-hidden="true" className="size-4" viewBox="0 0 256 256">
    <path
      d="M20 0h216c11.046 0 20 8.954 20 20v216c0 11.046-8.954 20-20 20H20c-11.046 0-20-8.954-20-20V20C0 8.954 8.954 0 20 0Z"
      fill="#3178C6"
    />
    <path
      d="M150.518 200.475v27.62c4.492 2.302 9.805 4.028 15.938 5.179 6.133 1.151 12.597 1.726 19.393 1.726 6.622 0 12.914-.633 18.874-1.899 5.96-1.266 11.187-3.352 15.678-6.257 4.492-2.906 8.048-6.704 10.669-11.394 2.62-4.689 3.93-10.486 3.93-17.391 0-5.006-.749-9.394-2.246-13.163a30.748 30.748 0 0 0-6.479-10.055c-2.821-2.935-6.205-5.567-10.149-7.898-3.945-2.33-8.394-4.531-13.347-6.602-3.628-1.497-6.881-2.949-9.761-4.359-2.879-1.41-5.327-2.848-7.342-4.316-2.016-1.467-3.571-3.021-4.665-4.661-1.094-1.64-1.641-3.495-1.641-5.567 0-1.899.489-3.61 1.468-5.135s2.362-2.834 4.147-3.927c1.785-1.094 3.973-1.942 6.565-2.547 2.591-.604 5.471-.906 8.638-.906 2.304 0 4.737.173 7.299.518 2.563.345 5.14.877 7.732 1.597a53.669 53.669 0 0 1 7.558 2.719 41.7 41.7 0 0 1 6.781 3.797v-25.807c-4.204-1.611-8.797-2.805-13.778-3.582-4.981-.777-10.697-1.165-17.147-1.165-6.565 0-12.784.705-18.658 2.115-5.874 1.409-11.043 3.61-15.506 6.602-4.463 2.993-7.99 6.805-10.582 11.437-2.591 4.632-3.887 10.17-3.887 16.615 0 8.228 2.375 15.248 7.127 21.06 4.751 5.811 11.963 10.731 21.638 14.759a291.458 291.458 0 0 1 10.625 4.575c3.283 1.496 6.119 3.049 8.509 4.66 2.39 1.611 4.276 3.366 5.658 5.265 1.382 1.899 2.073 4.057 2.073 6.474a9.901 9.901 0 0 1-1.296 4.963c-.863 1.524-2.174 2.848-3.93 3.97-1.756 1.122-3.945 1.999-6.565 2.632-2.62.633-5.687.95-9.2.95-5.989 0-11.92-1.05-17.794-3.151-5.875-2.1-11.317-5.25-16.327-9.451Zm-46.036-68.733H140V109H41v22.742h35.345V233h28.137V131.742Z"
      fill="#FFF"
    />
  </svg>
)

const JsonIcon = () => {
  const gradientId = useId()
  const reverseGradientId = useId()

  return (
    <svg aria-hidden="true" className="size-4" viewBox="0 0 160 160">
      <defs>
        <linearGradient id={gradientId}>
          <stop offset="0" />
          <stop offset="1" stopColor="#fff" />
        </linearGradient>
        <linearGradient
          id={reverseGradientId}
          x1="-553.27"
          x2="-666.12"
          y1="525.91"
          y2="413.05"
          gradientTransform="matrix(.99884 0 0 .9987 689.01 -388.84)"
          gradientUnits="userSpaceOnUse"
          href={`#${gradientId}`}
        />
        <linearGradient
          id={`${gradientId}-forward`}
          x1="-666.12"
          x2="-553.27"
          y1="413.04"
          y2="525.91"
          gradientTransform="matrix(.99884 0 0 .9987 689.01 -388.84)"
          gradientUnits="userSpaceOnUse"
          href={`#${gradientId}`}
        />
      </defs>
      <g fillRule="evenodd">
        <path
          fill={`url(#${gradientId}-forward)`}
          d="M79.865 119.1c35.398 48.255 70.04-13.469 69.989-50.587C149.794 24.627 105.313.099 79.836.099 38.944.099 0 33.895 0 80.135 0 131.531 44.64 160 79.836 160c-7.965-1.147-34.506-6.834-34.863-67.967-.24-41.347 13.488-57.866 34.805-50.599.477.177 23.514 9.265 23.514 38.951 0 29.56-23.427 38.715-23.427 38.715z"
        />
        <path
          fill={`url(#${reverseGradientId})`}
          d="M79.823 41.401C56.433 33.339 27.78 52.617 27.78 91.23c0 63.048 46.721 68.77 52.384 68.77C121.056 160 160 126.204 160 79.964 160 28.568 115.36.099 80.164.099c9.748-1.35 52.541 10.55 52.541 69.037 0 38.141-31.953 58.905-52.735 50.033-.477-.177-23.514-9.264-23.514-38.951 0-29.56 23.367-38.818 23.367-38.818z"
        />
      </g>
    </svg>
  )
}

const EnvIcon = () => (
  <svg aria-hidden="true" className="size-4" viewBox="0 0 24 24">
    <rect width="24" height="24" fill="#09090B" />
    <path
      fill="#ECD53F"
      d="M24 0v24H0V0h24ZM10.933 15.89H6.84v5.52h4.198v-.93H7.955v-1.503h2.77v-.93h-2.77v-1.224h2.978v-.934Zm2.146 0h-1.084v5.52h1.035v-3.6l2.226 3.6h1.118v-5.52h-1.036v3.686l-2.259-3.687Zm5.117 0h-1.208l1.973 5.52h1.19l1.976-5.52h-1.182l-1.352 4.085-1.397-4.086ZM5.4 19.68H3.72v1.68H5.4v-1.68Z"
    />
  </svg>
)

const CodeLabelIcon = ({ label }: { label: string }) => {
  const normalizedLabel = label.toLowerCase()

  if (normalizedLabel === "terminal") {
    return <HugeiconsIcon icon={TerminalIcon} className="size-4" />
  }

  if (normalizedLabel.endsWith(".ts") || normalizedLabel.endsWith(".tsx")) {
    return <TypeScriptIcon />
  }

  if (
    normalizedLabel.endsWith(".json") ||
    normalizedLabel.endsWith(".jsonc") ||
    normalizedLabel.includes("response") ||
    normalizedLabel.includes("node")
  ) {
    return <JsonIcon />
  }

  if (/^(get|post|put|patch|delete) /.test(normalizedLabel)) {
    return <HugeiconsIcon icon={ApiIcon} className="size-4" />
  }

  if (normalizedLabel.includes("env")) {
    return <EnvIcon />
  }

  if (normalizedLabel.includes("prompt")) {
    return <HugeiconsIcon icon={StarsIcon} className="size-4" />
  }

  return <HugeiconsIcon icon={FileEmpty01Icon} className="size-4" />
}

const getCodeCopyStatusMessage = (
  copyState: "idle" | "copied" | "error",
  label: string
) => {
  if (copyState === "copied") {
    return `${label} copied`
  }

  if (copyState === "error") {
    return `${label} couldn’t be copied. Try again.`
  }

  return ""
}

function DocSection({ id, children }: { id: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      {children}
    </section>
  )
}

const subscribeToLocationHash = (onHashChange: () => void) => {
  window.addEventListener("hashchange", onHashChange)
  return () => window.removeEventListener("hashchange", onHashChange)
}

const getLocationHash = () => window.location.hash

export function DocsFaq({
  question,
  children,
}: {
  question: string
  children: ReactNode
}) {
  const fallbackId = useId().replaceAll(/[^a-zA-Z0-9]/g, "")
  // A stable slug keeps deep links readable (docs page URL + #faq-slug);
  // questions without any slugifiable character fall back to useId.
  const itemId = `faq-${createHeadingId(question) || fallbackId}`
  const locationHash = useSyncExternalStore(
    subscribeToLocationHash,
    getLocationHash,
    () => ""
  )
  // A hash targeting this item is a pointer that opens it — on deep links
  // and in-page anchor clicks alike. null means the user has not interacted
  // yet, so the hash alone decides; after a manual toggle the user's choice
  // wins until navigation changes the hash target again.
  const [userIntent, setUserIntent] = useState<boolean | null>(null)
  const open = userIntent ?? locationHash === `#${itemId}`

  return (
    <Accordion
      className="docs-faq not-typeset rounded-none border-0"
      value={open ? [itemId] : []}
      onValueChange={(value) => setUserIntent(value.includes(itemId))}
    >
      {/* The shared accordion item highlights open items with a background;
          docs FAQ rows stay plain, separated only by the list divider. */}
      <AccordionItem
        id={itemId}
        value={itemId}
        className="data-open:bg-transparent"
      >
        <AccordionPrimitive.Header className="group/heading flex items-center">
          <AccordionPrimitive.Trigger className="group/accordion-trigger flex flex-1 items-center gap-3 rounded-sm py-4 pr-2 text-left text-sm font-normal outline-none hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <HugeiconsIcon
              icon={ArrowDown01Icon}
              aria-hidden="true"
              className="size-4 shrink-0 text-muted-foreground transition-transform duration-300 [transition-timing-function:cubic-bezier(0.2,0,0,1)] group-aria-expanded/accordion-trigger:rotate-180 motion-reduce:transition-none"
              strokeWidth={2}
            />
            <span className="min-w-0 flex-1">{question}</span>
          </AccordionPrimitive.Trigger>
          <DocsHeadingAnchor
            headingId={itemId}
            label={question}
            onClick={() => setUserIntent(true)}
          />
        </AccordionPrimitive.Header>
        <AccordionContent className="pl-3 pb-4 leading-6 text-muted-foreground">
          {children}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

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

  const matrixMatch = transform.match(/^matrix(3d)?\(([-\d.e\s,]+)\)$/u)
  if (!matrixMatch) {
    return transform
  }

  const values = matrixMatch[2].split(",").map((value) => Number(value.trim()))
  const isThreeDimensional = Boolean(matrixMatch[1])
  const [scale] = values
  const translateX = values[isThreeDimensional ? 12 : 4]
  const translateY = values[isThreeDimensional ? 13 : 5]
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
  onFinish?: () => void
  property: "opacity" | "transform"
  to: string
}): Animation | undefined => {
  element.style[property] = from
  if (prefersReducedMotion()) {
    element.style[property] = to
    onFinish?.()
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
    onFinish?.()
    return undefined
  }
  if (onFinish) {
    // Cancelling a retargeted animation rejects `finished` by design.
    void animation.finished.then(onFinish, () => undefined)
  }
  return animation
}

interface CollapseState {
  collapsedTransform: string
  currentOpacity: string
  currentTransform: string
}

interface MutableAnimationRef {
  current: Animation | undefined
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
      const openAnimationRef: MutableAnimationRef = { current: undefined }
      const imageAnimation = animateStyle({
        element: zoomedImage,
        from: expansionPose.collapsedTransform,
        onFinish: () => {
          if (
            disposed ||
            closingRef.current ||
            phaseRef.current !== "expanded" ||
            animationGeneration !== animationGenerationRef.current
          ) {
            return
          }
          zoomedImage.style.transform = expansionPose.expandedTransform
          cancelAnimation(openAnimationRef.current)
          zoomedImage.style.willChange = "auto"
        },
        property: "transform",
        to: expansionPose.expandedTransform,
      })
      openAnimationRef.current = imageAnimation
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

// Google Play listing captures framed by scripts/frame-store-screenshots.mjs.
const DOCS_INSTALL_APP_SHOTS = [
  {
    alt: "TV Bro listing on Google Play",
    href: "https://play.google.com/store/apps/details?id=com.phlox.tvwebbrowser",
    source: "/images/docs/play-store-tv-bro.webp",
  },
  {
    alt: "Just (Video) Player listing on Google Play",
    href: "https://play.google.com/store/apps/details?id=com.brouken.player",
    source: "/images/docs/play-store-just-player.webp",
  },
  {
    alt: "VLC for Android listing on Google Play",
    href: "https://play.google.com/store/apps/details?id=org.videolan.vlc",
    source: "/images/docs/play-store-vlc.webp",
  },
]

function DocsInstallApps() {
  return (
    <div className="not-typeset my-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
      {DOCS_INSTALL_APP_SHOTS.map((shot) => (
        <a
          key={shot.href}
          href={shot.href}
          target="_blank"
          rel="noreferrer"
          className="block rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <img
            src={shot.source}
            alt={shot.alt}
            loading="lazy"
            className="h-auto w-full"
          />
        </a>
      ))}
    </div>
  )
}

export function DocsScreenshot({ name, alt }: { name: string; alt: string }) {
  const image = getDocumentationImageAsset(name)
  const thumbnailRef = useRef<HTMLButtonElement>(null)
  const [zoomOpen, setZoomOpen] = useState(false)

  if (!image) {
    throw new Error(`Documentation screenshot asset is missing: ${name}`)
  }

  return (
    <figure className="not-typeset my-10">
      <button
        ref={thumbnailRef}
        type="button"
        onClick={() => setZoomOpen(true)}
        aria-label={`Open image: ${alt}`}
        aria-expanded={zoomOpen}
        className="mx-auto block w-full cursor-zoom-in overflow-hidden rounded-md border border-border focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {/* Framed docs screenshots share one fixed canvas, so full-width
            rendering keeps every figure the same size. */}
        <img
          src={image.source}
          alt={alt}
          loading="lazy"
          className="h-auto w-full object-cover"
        />
      </button>

      {zoomOpen && (
        <DocsScreenshotZoom
          alt={alt}
          imageSource={image.source}
          thumbnailRef={thumbnailRef}
          onClose={() => setZoomOpen(false)}
        />
      )}
    </figure>
  )
}

function CodeBlock({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  const figureRef = useRef<HTMLElement>(null)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle"
  )

  useEffect(
    () => () => {
      clearTimeout(resetTimerRef.current)
    },
    []
  )

  const copyCode = async () => {
    const code = figureRef.current?.querySelector("pre code")?.textContent
    if (!code) {
      return
    }

    try {
      if (navigator.clipboard && window.isSecureContext) {
        try {
          await navigator.clipboard.writeText(code)
        } catch {
          copyWithTextArea(code)
        }
      } else {
        copyWithTextArea(code)
      }

      setCopyState("copied")
    } catch {
      setCopyState("error")
    }

    clearTimeout(resetTimerRef.current)
    resetTimerRef.current = setTimeout(() => setCopyState("idle"), 2000)
  }

  return (
    <figure
      ref={figureRef}
      className="not-typeset my-5 overflow-hidden rounded-lg border border-foreground/15"
    >
      <figcaption className="flex min-h-10 items-center justify-between gap-3 border-b border-foreground/15 bg-muted/30 pl-4 pr-1 text-sm text-muted-foreground">
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="size-4 shrink-0">
            <CodeLabelIcon label={label} />
          </span>
          <span className="truncate">{label}</span>
        </span>
        <button
          type="button"
          onClick={() => void copyCode()}
          aria-label={
            copyState === "copied"
              ? `Copied ${label}`
              : `Copy code from ${label}`
          }
          className="relative flex size-9 shrink-0 items-center justify-center rounded-lg text-foreground transition-[background-color,scale] duration-150 hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring active:scale-[0.96]"
        >
          <span className="relative size-3.5" aria-hidden="true">
            <HugeiconsIcon
              icon={CopyIcon}
              className={cn(
                "absolute inset-0 size-3.5 transition-[opacity,scale,filter] duration-200",
                copyState === "copied"
                  ? "scale-25 opacity-0 blur-[4px]"
                  : "scale-100 opacity-100 blur-0"
              )}
            />
            <HugeiconsIcon
              icon={Tick02Icon}
              className={cn(
                "absolute inset-0 size-3.5 transition-[opacity,scale,filter] duration-200",
                copyState === "copied"
                  ? "scale-100 opacity-100 blur-0"
                  : "scale-25 opacity-0 blur-[4px]"
              )}
            />
          </span>
          <span aria-live="polite" className="sr-only">
            {getCodeCopyStatusMessage(copyState, label)}
          </span>
        </button>
      </figcaption>
      {children}
    </figure>
  )
}

function DocsNote({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Alert className="not-typeset mt-[var(--typeset-flow)]">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}

const AndroidTvRemoteTroubleshooting = () => (
  <aside
    aria-labelledby="virtual-remote-troubleshooting-title"
    className="not-typeset my-3 rounded-2xl bg-muted/35 p-5 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.07)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
  >
    <div className="flex items-start gap-4">
      <span className="flex h-7 w-10 shrink-0 items-center justify-center">
        <HugeiconsIcon
          icon={WifiError01Icon}
          aria-hidden="true"
          className="size-7"
          strokeWidth={1.5}
        />
      </span>

      <div className="min-w-0 flex-1">
        <h3
          id="virtual-remote-troubleshooting-title"
          className="text-lg font-medium"
        >
          Can’t connect the virtual remote?
        </h3>

        <ol className="mt-4 flex list-decimal flex-col gap-2 pl-5 text-sm leading-6">
          <li>
            Connect your Android phone or tablet and Android TV to the same
            Wi-Fi network.
          </li>
          <li>Complete the pairing prompt in the Google TV app.</li>
          <li>Select the TV Bro address bar on Android TV and try again.</li>
        </ol>
      </div>
    </div>
  </aside>
)

const primitiveSchema = Schema.Union([Schema.String, Schema.Number])

const getNodeText = (node: ReactNode): string => {
  const primitive = Schema.decodeUnknownResult(primitiveSchema)(node)
  if (Result.isSuccess(primitive)) {
    return String(primitive.success)
  }

  if (Array.isArray(node)) {
    return node.map((child) => getNodeText(child)).join("")
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return getNodeText(node.props.children)
  }

  return ""
}

const createHeadingId = (children: ReactNode) =>
  getNodeText(children)
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/(^-|-$)/g, "")

const DocsHeadingAnchor = ({
  headingId,
  label,
  onClick,
}: {
  headingId: string
  label: string
  onClick?: ComponentProps<"a">["onClick"]
}) => (
  <a
    href={`#${headingId}`}
    onClick={onClick}
    aria-label={`Link to ${label}`}
    className="not-typeset flex size-10 shrink-0 scale-[0.25] items-center justify-center rounded-lg text-blue-500 opacity-0 transition-[opacity,scale] duration-200 [transition-timing-function:cubic-bezier(0.2,0,0,1)] group-hover/heading:scale-100 group-hover/heading:opacity-100 focus-visible:scale-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-blue-400"
  >
    <HugeiconsIcon
      icon={Link02Icon}
      aria-hidden="true"
      className="size-4 rotate-45"
      strokeWidth={2}
    />
  </a>
)

function DocsTable({ children, ...props }: ComponentProps<"table">) {
  return (
    <div className="typeset-scroll">
      <table {...props}>{children}</table>
    </div>
  )
}

const DocsLink = ({
  children,
  className,
  href,
  ...props
}: ComponentProps<"a">) =>
  href?.startsWith("/") ? (
    <Link to={href} prefetch="intent" className={className}>
      {children}
    </Link>
  ) : (
    <a
      {...props}
      href={href}
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noreferrer" : undefined}
      className={cn("inline-flex items-center gap-1", className)}
    >
      <span>{children}</span>
      {href?.startsWith("http") && (
        <HugeiconsIcon
          icon={ArrowUpRight01Icon}
          aria-hidden="true"
          className="size-3.5 shrink-0"
          strokeWidth={2}
        />
      )}
    </a>
  )

export const docsComponents: MDXComponents = {
  AndroidTvRemoteTroubleshooting,
  DocSection,
  CodeBlock,
  DocsInstallApps,
  DocsNote,
  DocsFaq,
  DocsScreenshot,
  h2: ({ children, id, ...props }) => {
    const headingId = id ?? createHeadingId(children)

    return (
      <h2
        id={headingId}
        {...props}
        className="group/heading flex items-center gap-1"
      >
        <span>{children}</span>
        <DocsHeadingAnchor
          headingId={headingId}
          label={getNodeText(children)}
        />
      </h2>
    )
  },
  h3: ({ children, id, ...props }) => {
    const headingId = id ?? createHeadingId(children)

    return (
      <h3
        id={headingId}
        {...props}
        className="group/heading flex items-center gap-1"
      >
        <span>{children}</span>
        <DocsHeadingAnchor
          headingId={headingId}
          label={getNodeText(children)}
        />
      </h3>
    )
  },
  a: DocsLink,
  pre: ({ className, ...props }) => (
    <pre
      {...props}
      className={cn(
        "overflow-x-auto bg-transparent p-4 font-mono text-[0.8125rem] font-medium leading-6",
        className
      )}
    />
  ),
  table: DocsTable,
}
