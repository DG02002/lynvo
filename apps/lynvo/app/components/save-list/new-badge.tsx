import { Badge } from "~/components/ui/badge"
import { cn } from "~/lib/utils"

export const NewBadge = ({ className }: { className?: string }) => (
  <Badge
    aria-hidden="true"
    className={cn("bg-success px-3 text-success-foreground", className)}
  >
    New
  </Badge>
)
