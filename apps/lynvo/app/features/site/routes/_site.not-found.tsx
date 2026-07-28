import { data } from "react-router"

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
        The page you’re looking for can’t be found.
      </h1>
    </section>
  )
}
