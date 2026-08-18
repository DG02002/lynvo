import { Link } from "react-router"

type LynvoLinkProps = {
  className?: string
}

export function LynvoLink({ className }: LynvoLinkProps) {
  return (
    <Link
      to="/"
      prefetch="intent"
      viewTransition
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
