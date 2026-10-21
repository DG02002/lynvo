import { Badge } from "~/components/ui/badge"

export const getShouldCenterMobileNewBadge = (
  shouldStackIconOnMobile: boolean,
  titleDisplay: "episode" | "filename" | undefined
) => shouldStackIconOnMobile && titleDisplay === "episode"

export const NewBadge = ({ className }: { className?: string }) => (
  <Badge variant="success" className={className} aria-hidden="true">
    New
  </Badge>
)
