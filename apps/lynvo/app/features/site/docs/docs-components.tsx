import { useEffect, useRef, useState } from "react"
import type { ComponentProps, ReactNode } from "react"
import { CopyIcon, Tick02Icon } from "@hugeicons/core-free-icons"
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

export const docsComponents: MDXComponents = {
  DocSection,
  CodeBlock,
  DocsNote,
  p: (props) => <p {...props} className="leading-7 text-pretty" />,
  h2: (props) => (
    <h2
      {...props}
      className="text-3xl font-normal tracking-tight text-balance"
    />
  ),
  h3: (props) => (
    <h3
      {...props}
      className="pt-5 text-xl font-normal tracking-tight text-balance"
    />
  ),
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

export const createDocsComponents = (
  activeChapterSlug: string
): MDXComponents => ({
  ...docsComponents,
  Chapter: ({ slug, children }: DocsChapterProps) =>
    slug === activeChapterSlug ? children : null,
})
