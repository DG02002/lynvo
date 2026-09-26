export const DocsPageActions = ({ page }: { page: DocumentationPage }) => (
  <a
    href={page.markdownUrl}
    target="_blank"
    rel="noreferrer"
    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-foreground/15 bg-background px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
  >
    <span>View Markdown</span>
    <svg
      aria-hidden="true"
      viewBox="0 0 208 128"
      className="h-3.5 w-auto text-current"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
        d="M15 5h178a10 10 0 0 1 10 10v98a10 10 0 0 1-10 10H15a10 10 0 0 1-10-10V15A10 10 0 0 1 15 5z"
      />
      <path
        fill="currentColor"
        d="M30 98V30h20l20 25 20-25h20v68H90V59L70 84 50 59v39H30zm125 0-30-33h20V30h20v35h20l-30 33z"
      />
    </svg>
  </a>
)
