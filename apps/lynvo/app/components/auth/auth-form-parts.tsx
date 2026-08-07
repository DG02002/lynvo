import type { ReactNode } from "react"
import { Link } from "react-router"
import { Button } from "~/components/ui/button"
import { Alert, AlertDescription } from "~/components/ui/alert"
import { Spinner } from "~/components/ui/spinner"
import { Field, FieldError, FieldGroup, FieldSet } from "~/components/field"
import { FloatingLabel } from "~/components/FloatingLabel"
import { LynvoLink } from "~/components/LynvoLink"
import { cn } from "~/lib/utils"
import { policyPaths } from "~/lib/paths"

const controlWidthClass = "mx-auto w-full max-w-sm"

export interface AuthFormShellProps {
  ariaLabel: string
  heading: string
  children: ReactNode
  switchPrompt: string
  switchLinkText: string
  switchTo: string
  onSubmit: () => void
}

export interface AuthTextFieldProps {
  id: string
  name: string
  label: string
  value: string
  type?: string
  errors?: Array<{ message?: string } | undefined>
  onChange: (value: string) => void
  onBlur?: () => void
}

export interface AuthSubmitButtonProps {
  isSubmitting: boolean
  submitText: string
  submittingText: string
  className?: string
}

export const AuthControl = ({ children }: { children: ReactNode }) => (
  <div className={controlWidthClass}>{children}</div>
)

export const AuthTextField = ({
  id,
  name,
  label,
  value,
  type,
  errors,
  onChange,
  onBlur,
}: AuthTextFieldProps) => (
  <AuthControl>
    <Field data-invalid={Boolean(errors?.length)}>
      <FloatingLabel
        id={id}
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        label={label}
        aria-invalid={Boolean(errors?.length)}
      />
      <FieldError errors={errors} />
    </Field>
  </AuthControl>
)

export const AuthFormAlert = ({ message }: { message: string }) => (
  <AuthControl>
    <Alert variant="destructive">
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  </AuthControl>
)

export const AuthSubmitButton = ({
  isSubmitting,
  submitText,
  submittingText,
  className,
}: AuthSubmitButtonProps) => (
  <AuthControl>
    <Button
      type="submit"
      size="lg"
      className={cn("h-13.5 w-full", className)}
      disabled={isSubmitting}
      aria-label={isSubmitting ? submittingText : undefined}
    >
      {isSubmitting ? (
        <Spinner className="size-4" aria-hidden="true" />
      ) : (
        submitText
      )}
    </Button>
  </AuthControl>
)

export const AuthPolicyLinks = () => (
  <div className="mt-3 hidden space-x-1 text-center text-xs text-muted-foreground md:block">
    <Link
      to={policyPaths.termsOfUse}
      viewTransition
      className="underline underline-offset-4"
    >
      Terms of use
    </Link>
    <span> | </span>
    <Link
      to={policyPaths.privacyPolicy}
      viewTransition
      className="underline underline-offset-4"
    >
      Privacy policy
    </Link>
  </div>
)

export const AuthDivider = () => (
  <AuthControl>
    <div className="relative my-4">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background px-2 text-muted-foreground">Or</span>
      </div>
    </div>
  </AuthControl>
)

export const AuthFormShell = ({
  ariaLabel,
  heading,
  children,
  switchPrompt,
  switchLinkText,
  switchTo,
  onSubmit,
}: AuthFormShellProps) => (
  <div className="mx-auto flex w-full max-w-md flex-col">
    <div className="flex-1 py-6 pb-16 md:py-8 md:pb-8">
      <form
        aria-label={ariaLabel}
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
      >
        <FieldSet className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 text-center">
            <LynvoLink className="text-lg font-medium text-foreground no-underline hover:text-foreground hover:no-underline focus-visible:no-underline" />
            <h1 className="text-4xl font-normal tracking-tight">{heading}</h1>
          </div>

          <FieldGroup className="gap-4">{children}</FieldGroup>

          <div className="mt-1 text-center text-base text-muted-foreground">
            {switchPrompt}{" "}
            <Link
              to={switchTo}
              viewTransition
              className="text-foreground underline underline-offset-4 hover:text-primary"
            >
              {switchLinkText}
            </Link>
          </div>

          <AuthPolicyLinks />
        </FieldSet>
      </form>
    </div>
  </div>
)
