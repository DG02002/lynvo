import { isRouteErrorResponse } from "react-router"

import type { Route } from "../+types/root"

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
  let message = "Page couldn’t be loaded"
  let details = "Try loading the page again."
  let stack: string | undefined

  if (isRouteErrorResponse(error)) {
    message =
      error.status === 404 ? "Page not found" : "Page couldn’t be loaded"
    details =
      error.status === 404
        ? "The address may be incorrect, or the page may have moved."
        : error.statusText || details
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message
    stack = error.stack
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <a
          href="/"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          Go home
        </a>
        <button
          type="button"
          className="rounded-md border border-border px-4 py-2"
          onClick={() => window.location.reload()}
        >
          Reload page
        </button>
      </div>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  )
}
