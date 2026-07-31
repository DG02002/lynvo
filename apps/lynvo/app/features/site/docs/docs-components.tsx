import { useEffect, useId, useRef, useState } from "react"
import type { ComponentProps, ReactNode } from "react"
import {
  ApiIcon,
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
import type { MDXComponents } from "mdx/types.js"
import { Link } from "react-router"

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
    <figure ref={figureRef} className="my-2 overflow-hidden rounded-lg border">
      <figcaption className="flex min-h-10 items-center justify-between gap-3 border-b bg-muted/30 pl-4 pr-1 text-sm text-foreground">
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
            {copyState === "copied"
              ? `${label} copied`
              : copyState === "error"
                ? `${label} couldn’t be copied. Try again.`
                : ""}
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
        Lynvo selects a player based on whether the video supports seeking.
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
          Videos that support seeking
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
          Videos that require standard playback
        </span>
      </div>
    </div>

    <p className="text-sm leading-6 text-muted-foreground">
      Change either default in <strong>Settings</strong> after you log in.
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

const getNodeText = (node: ReactNode): string => {
  if (typeof node === "string" || typeof node === "number") {
    return String(node)
  }

  if (Array.isArray(node)) {
    return node.map((child) => getNodeText(child)).join("")
  }

  if (
    typeof node === "object" &&
    node !== null &&
    "props" in node &&
    typeof node.props === "object" &&
    node.props !== null &&
    "children" in node.props
  ) {
    return getNodeText(node.props.children as ReactNode)
  }

  return ""
}

const createHeadingId = (children: ReactNode) =>
  getNodeText(children)
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

const DocsLink = ({
  children,
  className,
  href,
  ...props
}: ComponentProps<"a">) =>
  href?.startsWith("/") ? (
    <Link
      to={href}
      className={cn(
        "underline decoration-foreground/30 underline-offset-4 transition-colors hover:decoration-foreground",
        className
      )}
    >
      {children}
    </Link>
  ) : (
    <a
      {...props}
      href={href}
      target={href?.startsWith("http") ? "_blank" : undefined}
      rel={href?.startsWith("http") ? "noreferrer" : undefined}
      className={cn(
        "inline-flex items-center gap-1 underline decoration-foreground/30 underline-offset-4 transition-colors hover:decoration-foreground",
        className
      )}
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
  AndroidTvPlayerDefaults,
  AndroidTvRemoteTroubleshooting,
  DocSection,
  CodeBlock,
  DocsNote,
  p: (props) => <p {...props} className="leading-7 text-pretty" />,
  h2: ({ children, id, ...props }) => {
    const headingId = id ?? createHeadingId(children)

    return (
      <h2
        id={headingId}
        {...props}
        className="group/heading flex scroll-mt-28 items-center gap-1 text-3xl font-normal tracking-tight text-balance"
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
        className="group/heading flex scroll-mt-28 items-center gap-1 pt-5 text-xl font-normal tracking-tight text-balance"
      >
        <span>{children}</span>
        <DocsHeadingAnchor
          headingId={headingId}
          label={getNodeText(children)}
        />
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
  a: DocsLink,
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
