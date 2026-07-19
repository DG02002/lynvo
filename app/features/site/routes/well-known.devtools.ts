import type { Route } from "./+types/well-known.devtools"

export function loader({ request: _ }: Route.LoaderArgs) {
  return new Response(null, { status: 404 })
}
