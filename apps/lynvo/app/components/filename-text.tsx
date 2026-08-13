import * as React from "react"
import { cn } from "~/lib/utils"
import { getFilenameBreakSegments } from "~/components/filename-text-segments"

interface FilenameTextProps {
  value: string
  className?: string
  textClassName?: string
  clampClassName?: string
}

interface FilenameSegmentsProps {
  value: string
}

const DEFAULT_CLAMP_CLASS_NAME = "line-clamp-2 md:line-clamp-3"

const FilenameSegments = ({ value }: FilenameSegmentsProps) => {
  const segments = getFilenameBreakSegments(value)

  return segments.map((segment, index) => (
    <React.Fragment key={`${index}-${segment}`}>
      {segment}
      {index < segments.length - 1 && <wbr />}
    </React.Fragment>
  ))
}

const appendFilenameSegments = (element: HTMLElement, value: string) => {
  const segments = getFilenameBreakSegments(value)

  segments.forEach((segment, index) => {
    element.appendChild(document.createTextNode(segment))
    if (index < segments.length - 1) {
      element.appendChild(document.createElement("wbr"))
    }
  })
}

const createMeasurementElement = (
  sourceElement: HTMLSpanElement,
  value: string,
  clampClassName?: string
) => {
  const computedStyle = window.getComputedStyle(sourceElement)
  const measurementElement = document.createElement("span")
  measurementElement.className = clampClassName ?? "block"
  measurementElement.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:${sourceElement.clientWidth}px;font:${computedStyle.font};letter-spacing:${computedStyle.letterSpacing};line-height:${computedStyle.lineHeight};overflow-wrap:${computedStyle.overflowWrap};word-break:${computedStyle.wordBreak};white-space:normal;`
  appendFilenameSegments(measurementElement, value)
  document.body.appendChild(measurementElement)
  return measurementElement
}

const getCollapsedValue = (textElement: HTMLSpanElement, value: string) => {
  const measurementElement = createMeasurementElement(textElement, "")

  const doesCandidateFit = (candidate: string) => {
    measurementElement.replaceChildren()
    appendFilenameSegments(measurementElement, candidate.trimEnd())
    measurementElement.appendChild(document.createTextNode(" "))

    const controlElement = document.createElement("span")
    controlElement.style.fontWeight = "500"
    controlElement.textContent = "See more"
    measurementElement.appendChild(controlElement)

    return measurementElement.scrollHeight <= textElement.clientHeight
  }

  let minimumLength = 0
  let maximumLength = value.length

  while (minimumLength < maximumLength) {
    const candidateLength = Math.ceil((minimumLength + maximumLength) / 2)
    if (doesCandidateFit(value.slice(0, candidateLength))) {
      minimumLength = candidateLength
    } else {
      maximumLength = candidateLength - 1
    }
  }

  measurementElement.remove()
  return value.slice(0, minimumLength).trimEnd()
}

const measureCollapsedFilename = (
  textElement: HTMLSpanElement,
  value: string,
  clampClassName: string
) => {
  const clampedMeasurement = createMeasurementElement(
    textElement,
    value,
    clampClassName
  )
  const doesOverflow =
    clampedMeasurement.scrollHeight > clampedMeasurement.clientHeight
  const collapsedValue = doesOverflow
    ? getCollapsedValue(clampedMeasurement, value)
    : value
  clampedMeasurement.remove()

  return { collapsedValue, doesOverflow }
}

export const FilenameText = ({
  value,
  className,
  textClassName,
  clampClassName = DEFAULT_CLAMP_CLASS_NAME,
}: FilenameTextProps) => {
  const [isExpanded, setIsExpanded] = React.useState(false)
  const [isOverflowing, setIsOverflowing] = React.useState(false)
  const [collapsedValue, setCollapsedValue] = React.useState(value)
  const containerRef = React.useRef<HTMLSpanElement>(null)

  React.useLayoutEffect(() => {
    if (isExpanded) {
      return
    }

    const textElement = containerRef.current
    if (!textElement) {
      return
    }

    const updateOverflowState = () => {
      const measurement = measureCollapsedFilename(
        textElement,
        value,
        clampClassName
      )
      const { doesOverflow } = measurement
      setIsOverflowing(doesOverflow)
      setCollapsedValue(measurement.collapsedValue)
    }

    updateOverflowState()
    if (globalThis.ResizeObserver === undefined) {
      window.addEventListener("resize", updateOverflowState)
      return () => window.removeEventListener("resize", updateOverflowState)
    }

    const resizeObserver = new ResizeObserver(updateOverflowState)
    resizeObserver.observe(textElement)

    return () => resizeObserver.disconnect()
  }, [clampClassName, isExpanded, value])

  const toggleExpanded = (event: React.SyntheticEvent) => {
    event.preventDefault()
    event.stopPropagation()
    setIsExpanded((currentIsExpanded) => !currentIsExpanded)
  }

  return (
    <span ref={containerRef} className={cn("block min-w-0", className)}>
      <span className={cn("break-words", textClassName)}>
        <FilenameSegments value={isExpanded ? value : collapsedValue} />
      </span>
      {isOverflowing && (
        <button
          type="button"
          aria-expanded={isExpanded}
          className="ml-1 inline cursor-pointer font-medium text-muted-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={toggleExpanded}
        >
          {isExpanded ? "See less" : "See more"}
        </button>
      )}
    </span>
  )
}
