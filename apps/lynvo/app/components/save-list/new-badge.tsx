import { Badge } from "~/components/ui/badge"

export const NewBadge = ({ className }: { className?: string }) => (
  <Badge variant="success" className={className} aria-hidden="true">
    New
  </Badge>
)
