import { useEffect, useRef, useState } from "react"
import type { ComponentProps, ReactNode } from "react"
import {
  ArrowUpRight01Icon,
  CopyIcon,
  Link02Icon,
  Tick02Icon,
  WifiError01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import type { MDXComponents } from "mdx/types.js"

import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { cn } from "~/lib/utils"

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

export function DocSection({
  id,
  children,
}: {
  id: string
  children: ReactNode
}) {
  return (
    <section id={id} className="flex scroll-mt-24 flex-col gap-4 [&>h2]:mb-5">
      {children}
    </section>
  )
}

export function CodeBlock({
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
      className="my-2 overflow-hidden rounded-xl border bg-muted/30"
    >
      <figcaption className="flex min-h-10 items-center justify-between gap-3 border-b pl-4 pr-1 text-xs text-muted-foreground">
        <span className="truncate">{label}</span>
        <button
          type="button"
          onClick={() => void copyCode()}
          aria-label={copyState === "copied" ? "Code copied" : "Copy code"}
          className="relative flex h-8 min-w-20 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2 text-xs transition-[color,background-color,scale] duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring active:scale-[0.96]"
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
          <span aria-live="polite">
            {copyState === "copied"
              ? "Copied"
              : copyState === "error"
                ? "Try again"
                : "Copy"}
          </span>
        </button>
      </figcaption>
      {children}
    </figure>
  )
}

export function DocsNote({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <Alert>
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}

export const AndroidTvPlayerDefaults = () => (
  <section
    aria-label="Recommended player defaults"
    className="my-3 flex flex-col gap-4"
  >
    <div className="flex flex-col gap-1">
      <p className="font-medium">Recommended player defaults</p>
      <p className="text-sm leading-6 text-muted-foreground">
        Lynvo selects a player based on the link’s resume support.
      </p>
    </div>

    <div className="divide-y border-y">
      <div className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="flex items-center gap-3">
          <img
            src="/icons/players/just.webp"
            alt=""
            className="size-10 rounded-lg object-cover"
          />
          <span>Just (Video) Player</span>
        </div>
        <span className="text-sm text-muted-foreground">
          Resume-supported links
        </span>
      </div>

      <div className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div className="flex items-center gap-3">
          <img
            src="/icons/players/vlc.webp"
            alt=""
            className="size-10 rounded-lg object-cover"
          />
          <span>VLC for Android</span>
        </div>
        <span className="text-sm text-muted-foreground">
          Links without resume support
        </span>
      </div>
    </div>

    <p className="text-sm leading-6 text-muted-foreground">
      Change either default in <strong>Settings</strong> after you sign in.
    </p>
  </section>
)

export const AndroidTvRemoteTroubleshooting = () => (
  <aside
    aria-labelledby="virtual-remote-troubleshooting-title"
    className="my-3 rounded-2xl bg-muted/35 p-5 shadow-[inset_0_0_0_1px_rgba(0,0,0,0.07)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.1)]"
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
          className="text-lg font-medium tracking-tight"
        >
          Can’t connect the virtual remote?
        </h3>

        <ol className="mt-4 flex list-decimal flex-col gap-2 pl-5 text-sm leading-6">
          <li>Connect your phone and Android TV to the same Wi-Fi network.</li>
          <li>Complete the pairing prompt in the Google TV app.</li>
          <li>Select the TV Bro address bar and try again.</li>
        </ol>
      </div>
    </div>
  </aside>
)

const createHeadingId = (children: ReactNode) =>
  String(children)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

const DocsHeadingAnchor = ({
  headingId,
  label,
}: {
  headingId: string
  label: string
}) => (
  <a
    href={`#${headingId}`}
    aria-label={`Link to ${label}`}
    className="flex size-10 shrink-0 scale-[0.25] items-center justify-center rounded-lg text-blue-500 opacity-0 transition-[opacity,scale] duration-200 [transition-timing-function:cubic-bezier(0.2,0,0,1)] group-hover/heading:scale-100 group-hover/heading:opacity-100 focus-visible:scale-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-blue-500 dark:text-blue-400"
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
    <div className="my-2 overflow-x-auto rounded-xl border">
      <table
        {...props}
        className="w-full min-w-xl border-collapse text-left text-sm"
      >
        {children}
      </table>
    </div>
  )
}

const AndroidTvExternalLink = ({
  children,
  className,
  ...props
}: ComponentProps<"a">) => (
  <a
    {...props}
    target="_blank"
    rel="noreferrer"
    className={cn(
      "inline-flex items-center gap-1 underline decoration-foreground/30 underline-offset-4 transition-colors hover:decoration-foreground",
      className
    )}
  >
    <span>{children}</span>
    <HugeiconsIcon
      icon={ArrowUpRight01Icon}
      aria-hidden="true"
      className="size-3.5 shrink-0"
      strokeWidth={2}
    />
  </a>
)

export const docsComponents: MDXComponents = {
  AndroidTvPlayerDefaults,
  AndroidTvRemoteTroubleshooting,
  DocSection,
  CodeBlock,
  DocsNote,
  p: (props) => <p {...props} className="leading-7 text-pretty" />,
  h2: ({ children, ...props }) => {
    const headingId = createHeadingId(children)

    return (
      <h2
        {...props}
        id={headingId}
        className="group/heading flex scroll-mt-28 items-center gap-1 text-3xl font-normal tracking-tight text-balance"
      >
        <span>{children}</span>
        <DocsHeadingAnchor headingId={headingId} label={String(children)} />
      </h2>
    )
  },
  h3: ({ children, ...props }) => {
    const headingId = createHeadingId(children)

    return (
      <h3
        {...props}
        id={headingId}
        className="group/heading flex scroll-mt-28 items-center gap-1 pt-5 text-xl font-normal tracking-tight text-balance"
      >
        <span>{children}</span>
        <DocsHeadingAnchor headingId={headingId} label={String(children)} />
      </h3>
    )
  },
  ul: (props) => (
    <ul {...props} className="flex list-disc flex-col gap-2 pl-5 leading-7" />
  ),
  ol: (props) => (
    <ol
      {...props}
      className="flex list-decimal flex-col gap-3 pl-5 leading-7"
    />
  ),
  a: ({ className, ...props }) => (
    <a
      {...props}
      className={cn(
        "underline decoration-foreground/30 underline-offset-4 transition-colors hover:decoration-foreground",
        className
      )}
    />
  ),
  pre: ({ className, ...props }) => (
    <pre
      {...props}
      className={cn(
        "overflow-x-auto bg-transparent p-4 text-[0.8125rem] leading-6",
        className
      )}
    />
  ),
  table: DocsTable,
  thead: (props) => <thead {...props} className="bg-muted/40" />,
  th: (props) => <th {...props} className="border-b px-4 py-3 font-medium" />,
  td: (props) => <td {...props} className="border-b px-4 py-3 align-top" />,
}

export const createAndroidTvDocsComponents = (): MDXComponents => ({
  ...docsComponents,
  a: AndroidTvExternalLink,
})
