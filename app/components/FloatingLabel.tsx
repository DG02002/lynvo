"use client"

import * as React from "react"

import { cn } from "~/lib/utils"

type FloatingLabelProps = React.ComponentProps<"input"> & {
  label: string
  wrapperClassName?: string
  labelClassName?: string
  endAdornment?: React.ReactNode
  endAdornmentClassName?: string
}

function FloatingLabel({
  id,
  label,
  className,
  wrapperClassName,
  labelClassName,
  endAdornment,
  endAdornmentClassName,
  placeholder = " ",
  ...props
}: FloatingLabelProps) {
  const generatedId = React.useId()
  const inputId = id ?? generatedId

  return (
    <div className={cn("relative", wrapperClassName)}>
      <input
        id={inputId}
        placeholder={placeholder}
        className={cn(
          "peer block w-full appearance-none rounded-4xl border-2 border-default-medium bg-transparent py-3.5 pl-5 text-base text-heading focus:border-blue-500 focus:outline-none focus:ring-0",
          endAdornment && "pr-16",
          className
        )}
        {...props}
      />
      {endAdornment ? (
        <div
          className={cn(
            "absolute inset-y-2 right-2 flex items-center text-muted-foreground",
            endAdornmentClassName
          )}
        >
          {endAdornment}
        </div>
      ) : null}
      <label
        htmlFor={inputId}
        className={cn(
          "pointer-events-none absolute inset-s-4 top-1/2 z-10 origin-left -translate-y-1/2 scale-100 bg-background px-1.5 text-sm text-muted-foreground transition-all duration-300 peer-placeholder-shown:top-1/2 peer-placeholder-shown:scale-100 peer-focus:top-0 peer-focus:scale-75 peer-focus:text-blue-500 peer-not-placeholder-shown:top-0 peer-not-placeholder-shown:scale-75 rtl:peer-focus:left-auto rtl:peer-focus:translate-x-1/4",
          labelClassName
        )}
      >
        {label}
      </label>
    </div>
  )
}

export { FloatingLabel }
