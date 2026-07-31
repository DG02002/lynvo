import { data, Link } from "react-router"
import { Button } from "~/components/ui/button"
import { sitePaths } from "~/lib/paths"

import type { Route } from "./+types/_site.not-found"

export function loader() {
  return data(null, { status: 404 })
}

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Page not found | Lynvo" },
    {
      name: "description",
      content: "The page you requested could not be found.",
    },
    { name: "robots", content: "noindex" },
  ]
}

export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-4xl font-normal tracking-tight text-balance sm:text-6xl">
        Page not found
      </h1>
      <p className="mt-4 max-w-xl text-muted-foreground">
        The address may be incorrect, or the page may have moved. Return home or
        open Help Center to continue.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button nativeButton={false} render={<Link to="/" />}>
          Go home
        </Button>
        <Button
          variant="outline"
          nativeButton={false}
          render={<Link to={sitePaths.helpCenter} />}
        >
          Open Help Center
        </Button>
      </div>
    </section>
  )
}
