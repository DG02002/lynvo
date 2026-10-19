import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

// Placeholder skeletons pulse on the app's sub-second loading cycle
// (app.css) so pending content reads as "arriving now"; reduced motion
// gets a static placeholder. Radii mirror the content being loaded.
const skeletonVariants = cva("loading-skeleton-pulse bg-muted", {
  variants: {
    radius: {
      default: "rounded-xl",
      none: "rounded-none",
      sm: "rounded-sm",
      md: "rounded-md",
      lg: "rounded-lg",
      full: "rounded-full",
    },
  },
  defaultVariants: {
    radius: "default",
  },
})

function Skeleton({
  className,
  radius = "default",
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof skeletonVariants>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(skeletonVariants({ radius }), className)}
      {...props}
    />
  )
}

export { Skeleton }
