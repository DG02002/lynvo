import {
  AlertCircleIcon,
  ArrowUpRight01Icon,
  Home01Icon,
  Refresh01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { isRouteErrorResponse } from "react-router"

import { Button, buttonVariants } from "~/components/ui/button"
import { GITHUB_ISSUES_URL } from "~/lib/support-links"

import type { Route } from "../+types/root"

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
  const isNotFound = isRouteErrorResponse(error) && error.status === 404
  const message = isNotFound ? "Page not found" : "Something went off course"
  const details = isNotFound
    ? "The address may be incorrect, or the page may have moved."
    : "Lynvo couldn’t finish loading this page. The problem is likely on our side—not something you caused."
  const stack =
    import.meta.env.DEV && error instanceof Error ? error.stack : undefined

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
      <div className="relative mb-8 grid size-20 place-items-center">
        <div className="absolute inset-0 rounded-full bg-destructive/5 ring-1 ring-destructive/10" />
        <div className="absolute inset-3 rounded-full bg-destructive/10 ring-1 ring-destructive/15" />
        <HugeiconsIcon
          icon={AlertCircleIcon}
          strokeWidth={1.5}
          className="relative size-7 text-destructive"
          aria-hidden="true"
        />
      </div>

      <p className="mb-3 text-sm font-medium text-destructive">
        {isNotFound ? "404 · Lost link" : "Temporary interruption"}
      </p>
      <h1 className="text-4xl font-normal tracking-tight text-balance sm:text-6xl">
        {message}
      </h1>
      <p className="mt-4 max-w-xl text-muted-foreground text-pretty">
        {details}
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {isNotFound ? (
          <a href="/" className={buttonVariants()}>
            <HugeiconsIcon icon={Home01Icon} data-icon="inline-start" />
            Go home
          </a>
        ) : (
          <Button type="button" onClick={() => window.location.reload()}>
            <HugeiconsIcon icon={Refresh01Icon} data-icon="inline-start" />
            Try again
          </Button>
        )}
        <a
          href={isNotFound ? "/help-center" : GITHUB_ISSUES_URL}
          target={isNotFound ? undefined : "_blank"}
          rel={isNotFound ? undefined : "noreferrer"}
          className={buttonVariants({ variant: "outline" })}
        >
          {isNotFound ? "Open Help Center" : "Report a problem"}
          {!isNotFound && (
            <HugeiconsIcon icon={ArrowUpRight01Icon} data-icon="inline-end" />
          )}
        </a>
      </div>

      {!isNotFound && (
        <p className="mt-6 max-w-md text-xs leading-relaxed text-muted-foreground/80 text-pretty">
          Trying again once is safe. If the page still doesn’t load, reporting
          it helps us investigate.
        </p>
      )}

      {stack && (
        <pre className="mt-8 w-full overflow-x-auto rounded-xl bg-muted p-4 text-left text-xs">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  )
}
