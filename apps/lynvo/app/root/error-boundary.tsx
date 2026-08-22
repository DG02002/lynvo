import { isRouteErrorResponse } from "react-router"

import { GITHUB_ISSUES_URL } from "~/lib/support-links"

import type { Route } from "../+types/root"

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
  const isNotFound = isRouteErrorResponse(error) && error.status === 404

  if (isNotFound) {
    return (
      <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
        <h1 className="text-4xl font-normal tracking-tight text-balance sm:text-6xl">
          The page you’re looking for can’t be found.
        </h1>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href="/"
            className="underline underline-offset-4 transition-opacity hover:opacity-70"
          >
            Take me home
          </a>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-4xl font-normal tracking-tight text-balance sm:text-6xl">
        Something went off course.
      </h1>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <a
          href={GITHUB_ISSUES_URL}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 transition-opacity hover:opacity-70"
        >
          Report a problem
        </a>
      </div>
    </main>
  )
}
