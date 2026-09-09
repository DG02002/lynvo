import { Link } from "react-router"
import { useViewTransition } from "~/lib/client-profile"

type LynvoLinkProps = {
  className?: string
}

export function LynvoLink({ className }: LynvoLinkProps) {
  const viewTransition = useViewTransition()

  return (
    <Link
      to="/"
      prefetch="intent"
      viewTransition={viewTransition}
      aria-label="Lynvo home"
      className={
        className ??
        "text-lg font-medium text-foreground no-underline hover:text-foreground hover:no-underline focus-visible:no-underline"
      }
    >
      Lynvo
    </Link>
  )
}
