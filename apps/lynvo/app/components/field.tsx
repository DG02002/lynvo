"use client"

import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { Label } from "~/components/ui/label"
import { cn } from "~/lib/utils"

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn(
        "flex flex-col gap-6 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3",
        className
      )}
      {...props}
    />
  )
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn(
        "group/field-group @container/field-group flex w-full flex-col gap-7 data-[slot=checkbox-group]:gap-3 *:data-[slot=field-group]:gap-4",
        className
      )}
      {...props}
    />
  )
}

const fieldVariants = cva(
  "group/field flex w-full gap-3 data-[invalid=true]:text-destructive",
  {
    variants: {
      orientation: {
        vertical: "flex-col *:w-full [&>.sr-only]:w-auto",
        horizontal:
          "flex-row items-center has-[>[data-slot=field-content]]:items-start *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        responsive:
          "flex-col *:w-full @md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:*:data-[slot=field-label]:flex-auto [&>.sr-only]:w-auto @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
      },
    },
    defaultVariants: {
      orientation: "vertical",
    },
  }
)

interface FieldContextValue {
  readonly errorId: string
  readonly isInvalid: boolean | undefined
}

const FieldContext = React.createContext<FieldContextValue | null>(null)

export const useFieldContext = () => React.useContext(FieldContext)

export const useFieldErrorId = () => {
  const context = useFieldContext()
  return context?.isInvalid === true ? context.errorId : undefined
}

function Field({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> &
  VariantProps<typeof fieldVariants> & {
    "data-invalid"?: boolean
  }) {
  const errorId = `field-error-${React.useId()}`
  const isInvalid =
    "data-invalid" in props ? props["data-invalid"] === true : undefined
  const contextValue = React.useMemo(
    () => ({
      errorId,
      isInvalid,
    }),
    [errorId, isInvalid]
  )

  return (
    <FieldContext.Provider value={contextValue}>
      <div
        role="group"
        data-slot="field"
        data-orientation={orientation}
        className={cn(fieldVariants({ orientation }), className)}
        {...props}
      />
    </FieldContext.Provider>
  )
}

function FieldLabel({
  className,
  ...props
}: React.ComponentProps<typeof Label>) {
  return (
    <Label
      data-slot="field-label"
      className={cn(
        "group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50 has-data-checked:bg-input/30 has-[>[data-slot=field]]:rounded-2xl has-[>[data-slot=field]]:border *:data-[slot=field]:p-4",
        "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col",
        className
      )}
      {...props}
    />
  )
}

function ErrorList({
  errors,
}: {
  errors: Array<{ message?: string } | undefined>
}) {
  const uniqueErrors = [
    ...new Map(errors.map((error) => [error?.message, error])).values(),
  ]

  if (uniqueErrors.length === 1) {
    return uniqueErrors[0]?.message
  }

  return (
    <ul className="ml-4 flex list-disc flex-col gap-1">
      {uniqueErrors.map(
        (error) =>
          error?.message && <li key={error.message}>{error.message}</li>
      )}
    </ul>
  )
}

function FieldError({
  className,
  children,
  errors,
  ...props
}: Omit<React.ComponentProps<"div">, "id"> & {
  errors?: Array<{ message?: string } | undefined>
}) {
  const fieldContext = useFieldContext()

  if (!children && (!errors || errors.length === 0)) {
    return null
  }

  return (
    <div
      id={fieldContext?.errorId}
      role="alert"
      data-slot="field-error"
      className={cn("text-sm font-normal text-destructive", className)}
      {...props}
    >
      {children || (errors && <ErrorList errors={errors} />)}
    </div>
  )
}

export { Field, FieldLabel, FieldError, FieldGroup, FieldSet }
