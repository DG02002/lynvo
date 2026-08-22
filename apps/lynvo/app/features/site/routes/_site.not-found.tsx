import { data, Link } from "react-router"

import type { Route } from "./+types/_site.not-found"

export const loader = () => data(null, { status: 404 })

export const meta = (_: Route.MetaArgs) => [
  { title: "Page not found | Lynvo" },
  {
    name: "description",
    content: "The page you requested could not be found.",
  },
  { name: "robots", content: "noindex" },
]

const NotFound = () => (
  <section className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-3xl flex-col items-center justify-center px-4 py-16 text-center">
    <h1 className="text-4xl font-normal tracking-tight text-balance sm:text-6xl">
      The page you’re looking for can’t be found.
    </h1>
    <div className="mt-8 flex flex-wrap justify-center gap-3">
      <Link
        to="/"
        className="underline underline-offset-4 transition-opacity hover:opacity-70"
      >
        Take me home
      </Link>
    </div>
  </section>
)

export default NotFound
