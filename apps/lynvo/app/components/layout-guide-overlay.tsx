import { useLayoutEffect, useState } from "react"

declare global {
  interface LayoutGuideOverlayProps {
    readonly surface: "save" | "fullscreen"
  }

  interface LayoutGuideMeasurement {
    readonly key: string
    readonly left: number
    readonly top: number
    readonly width: number
    readonly height: number
  }
}

const targetSelectorsBySurface = {
  save: [
    "[data-site-header]",
    '[data-layout-guide-target="save-frame"]',
    '[data-layout-guide-target="save-input"]',
    '[data-layout-guide-target="save-content"]',
    '[data-layout-guide-target="list-view"]',
    '[data-layout-guide-target="list-header"]',
    '[data-layout-guide-target="list-sidebar"]',
    '[data-layout-guide-target="list-content"]',
    '[data-layout-guide-target="library-section"]',
    '[data-layout-guide-target="library-grid"]',
    '[data-layout-guide-target="library-card"]',
    '[data-layout-guide-target="list-row"]',
  ],
  fullscreen: [
    '[data-layout-guide-target="fullscreen-frame"]',
    '[data-layout-guide-target="fullscreen-back"]',
    '[data-layout-guide-target="fullscreen-header"]',
    '[data-layout-guide-target="fullscreen-sidebar"]',
    '[data-layout-guide-target="fullscreen-entries"]',
    '[data-layout-guide-target="fullscreen-row"]',
  ],
} as const

const getTargetSelector = (surface: LayoutGuideOverlayProps["surface"]) =>
  targetSelectorsBySurface[surface].join(",")

const getTargetElements = (surface: LayoutGuideOverlayProps["surface"]) =>
  Array.from(document.querySelectorAll<HTMLElement>(getTargetSelector(surface)))

const isElementInMotion = (element: HTMLElement): boolean => {
  const animations = element.getAnimations?.()
  return (
    animations?.some((animation) => animation.playState === "running") ?? false
  )
}

const getTargetMeasurements = (
  targetElements: readonly HTMLElement[]
): LayoutGuideMeasurement[] => {
  return targetElements
    .filter((element) => !isElementInMotion(element))
    .map((element, elementIndex) => {
      const rectangle = element.getBoundingClientRect()
      const target = element.dataset.layoutGuideTarget ?? "site-header"
      return {
        key: `${target}-${elementIndex}`,
        left: rectangle.left,
        top: rectangle.top,
        width: rectangle.width,
        height: rectangle.height,
      }
    })
    .filter((measurement) => measurement.width > 0 && measurement.height > 0)
}

const areMeasurementsEqual = (
  currentMeasurements: readonly LayoutGuideMeasurement[],
  nextMeasurements: readonly LayoutGuideMeasurement[]
): boolean => {
  if (currentMeasurements.length !== nextMeasurements.length) {
    return false
  }

  return currentMeasurements.every((measurement, measurementIndex) => {
    const nextMeasurement = nextMeasurements[measurementIndex]
    return (
      measurement.key === nextMeasurement?.key &&
      measurement.left === nextMeasurement.left &&
      measurement.top === nextMeasurement.top &&
      measurement.width === nextMeasurement.width &&
      measurement.height === nextMeasurement.height
    )
  })
}

const getGuidePositions = (
  measurements: readonly LayoutGuideMeasurement[],
  getStartPosition: (measurement: LayoutGuideMeasurement) => number,
  getEndPosition: (measurement: LayoutGuideMeasurement) => number,
  viewportSize: number | undefined
): number[] => {
  const positions = new Set(
    measurements
      .flatMap((measurement) => [
        getStartPosition(measurement),
        getEndPosition(measurement),
      ])
      .map((position) => Math.round(position))
  )
  const maxPosition = viewportSize ?? Number.POSITIVE_INFINITY

  return Array.from(positions)
    .filter((position) => position > 1 && position < maxPosition - 1)
    .sort((firstPosition, secondPosition) => firstPosition - secondPosition)
}

export const LayoutGuideOverlay = ({ surface }: LayoutGuideOverlayProps) => {
  const [measurements, setMeasurements] = useState<LayoutGuideMeasurement[]>([])

  useLayoutEffect(() => {
    let measurementFrameId: number | undefined

    const updateMeasurements = () => {
      const targetElements = getTargetElements(surface)
      resizeObserver?.disconnect()
      targetElements.forEach((element) => resizeObserver?.observe(element))
      const nextMeasurements = getTargetMeasurements(targetElements)
      setMeasurements((currentMeasurements) =>
        areMeasurementsEqual(currentMeasurements, nextMeasurements)
          ? currentMeasurements
          : nextMeasurements
      )
    }

    const scheduleMeasurements = () => {
      if (measurementFrameId !== undefined) {
        return
      }
      measurementFrameId = window.requestAnimationFrame(() => {
        measurementFrameId = undefined
        updateMeasurements()
      })
    }

    const handleMotionEnd = () => {
      scheduleMeasurements()
    }

    const resizeObserver = globalThis.ResizeObserver
      ? new globalThis.ResizeObserver(scheduleMeasurements)
      : undefined
    const mutationObserver = globalThis.MutationObserver
      ? new globalThis.MutationObserver(scheduleMeasurements)
      : undefined
    window.addEventListener("resize", scheduleMeasurements)
    document.addEventListener("animationend", handleMotionEnd, true)
    document.addEventListener("animationcancel", handleMotionEnd, true)
    document.addEventListener("transitionend", handleMotionEnd, true)
    document.addEventListener("transitioncancel", handleMotionEnd, true)
    mutationObserver?.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "style"],
      childList: true,
      subtree: true,
    })
    updateMeasurements()

    return () => {
      window.removeEventListener("resize", scheduleMeasurements)
      document.removeEventListener("animationend", handleMotionEnd, true)
      document.removeEventListener("animationcancel", handleMotionEnd, true)
      document.removeEventListener("transitionend", handleMotionEnd, true)
      document.removeEventListener("transitioncancel", handleMotionEnd, true)
      if (measurementFrameId !== undefined) {
        window.cancelAnimationFrame(measurementFrameId)
      }
      resizeObserver?.disconnect()
      mutationObserver?.disconnect()
    }
  }, [surface])

  const verticalGuidePositions = getGuidePositions(
    measurements,
    (measurement) => measurement.left,
    (measurement) => measurement.left + measurement.width,
    globalThis.innerWidth
  )
  const horizontalGuidePositions = getGuidePositions(
    measurements,
    (measurement) => measurement.top,
    (measurement) => measurement.top + measurement.height,
    globalThis.innerHeight
  )

  return (
    <div
      aria-hidden="true"
      data-layout-guide
      data-layout-guide-surface={surface}
      className="layout-guide-overlay"
    >
      <span className="layout-guide-overlay__marker" />
      {verticalGuidePositions.map((leftPosition) => (
        <span
          key={`vertical-${leftPosition}`}
          data-layout-guide-line="vertical"
          className="layout-guide-overlay__line layout-guide-overlay__line--vertical"
          style={{ left: leftPosition }}
        />
      ))}
      {horizontalGuidePositions.map((topPosition) => (
        <span
          key={`horizontal-${topPosition}`}
          data-layout-guide-line="horizontal"
          className="layout-guide-overlay__line layout-guide-overlay__line--horizontal"
          style={{ top: topPosition }}
        />
      ))}
    </div>
  )
}
