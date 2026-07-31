import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Link } from "react-router"

import { Button } from "~/components/ui/button"

const MarkdownIcon = () => (
  <svg aria-hidden="true" fill="none" viewBox="0 0 208 128">
    <g fill="currentColor">
      <path
        clipRule="evenodd"
        d="M15 10a5 5 0 0 0-5 5v98a5 5 0 0 0 5 5h178a5 5 0 0 0 5-5V15a5 5 0 0 0-5-5zM0 15A15 15 0 0 1 15 0h178a15 15 0 0 1 15 15v98a15 15 0 0 1-15 15H15a15 15 0 0 1-15-15z"
        fillRule="evenodd"
      />
      <path d="M30 98V30h20l20 25 20-25h20v68H90V59L70 84 50 59v39zm125 0-30-33h20V30h20v35h20z" />
    </g>
  </svg>
)

const PageArrow = ({
  page,
  direction,
}: {
  page?: DocumentationPage
  direction: "previous" | "next"
}) => {
  const label = direction === "previous" ? "Previous page" : "Next page"
  const icon = direction === "previous" ? ArrowLeft01Icon : ArrowRight01Icon

  if (!page) {
    return (
      <Button
        type="button"
        variant="secondary"
        size="icon-sm"
        aria-label={label}
        disabled
      >
        <HugeiconsIcon icon={icon} strokeWidth={2} />
      </Button>
    )
  }

  return (
    <Button
      variant="secondary"
      size="icon-sm"
      nativeButton={false}
      aria-label={`${label}: ${page.navLabel}`}
      render={<Link to={page.url} />}
    >
      <HugeiconsIcon icon={icon} strokeWidth={2} />
    </Button>
  )
}

export const DocsPageActions = ({
  page,
  previous,
  next,
}: {
  page: DocumentationPage
  previous?: DocumentationPage
  next?: DocumentationPage
}) => (
  <div className="flex items-center gap-2">
    <Button
      variant="secondary"
      size="sm"
      nativeButton={false}
      className="gap-3 rounded-lg"
      render={
        <a href={page.markdownUrl} target="_blank" rel="noreferrer">
          <MarkdownIcon />
          <span>View this page as Markdown</span>
        </a>
      }
    />

    <div className="flex items-center gap-1">
      <PageArrow page={previous} direction="previous" />
      <PageArrow page={next} direction="next" />
    </div>
  </div>
)
