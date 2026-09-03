import type { ComponentProps } from "react"
import { cn } from "~/lib/utils"

const LoaderCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={24}
    height={24}
    color="currentColor"
    fill="none"
    {...props}
  >
    <path
      d="M21.9961 12C21.9961 17.5228 17.5189 22 11.9961 22C6.47325 22 1.99609 17.5228 1.99609 12C1.99609 6.47715 6.47325 2 11.9961 2"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
    />
  </svg>
)

type SpinnerProps = ComponentProps<typeof LoaderCircleIcon>

const Spinner = ({ className, ...props }: SpinnerProps) => (
  <LoaderCircleIcon
    data-slot="spinner"
    role="status"
    aria-label="Loading"
    className={cn("size-4 animate-spin", className)}
    {...props}
  />
)

export { Spinner }
