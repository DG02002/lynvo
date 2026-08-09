import { Link } from "react-router"
import { Button } from "~/components/ui/button"
import { DeviceLoginQr } from "~/components/auth/DeviceLoginQr"
import { LynvoLink } from "~/components/LynvoLink"
import { authPaths, policyPaths } from "~/lib/paths"

export function meta() {
  return [
    { title: "Log in on this device | Lynvo" },
    {
      name: "description",
      content: "Scan a QR code to log in to Lynvo from another device.",
    },
  ]
}

export default function SignInWithAnotherDevice() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col">
      <div className="flex-1 py-6 pb-16 md:py-8 md:pb-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 text-center">
            <LynvoLink className="text-lg font-medium text-foreground no-underline hover:text-foreground hover:no-underline focus-visible:no-underline" />
            <h1 className="text-4xl font-normal tracking-tight">
              Log in on this device
            </h1>
            <p className="text-balance text-lg text-muted-foreground">
              On a device where you’re already logged in to Lynvo, scan the QR
              code below.
            </p>
          </div>

          <div className="mx-auto flex w-full max-w-sm justify-center">
            <DeviceLoginQr />
          </div>

          <div className="mx-auto w-full max-w-sm">
            <Button
              variant="secondary"
              className="h-13.5 w-full"
              render={
                <Link to={authPaths.signIn} viewTransition>
                  Back to log in
                </Link>
              }
            />
          </div>

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
        </div>
      </div>
    </div>
  )
}
