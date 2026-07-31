import { useEffect, useState } from "react"
import { Link } from "react-router"

import { Button } from "~/components/ui/button"
import { Checkbox } from "~/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import {
  defaultCookiePreferences,
  loadCookiePreferences,
  saveCookiePreferences,
} from "~/lib/cookie-preferences"
import { OPEN_COOKIE_PREFERENCES_EVENT } from "~/lib/constants"
import { policyPaths } from "~/lib/paths"

const preferenceOptions = [
  {
    key: "analytics",
    label: "Analytics cookies",
    description:
      "These cookies help Lynvo measure site traffic and improve performance.",
  },
  {
    key: "marketingMeasurement",
    label: "Marketing measurement",
    description:
      "These cookies help Lynvo measure the effectiveness of marketing campaigns.",
  },
  {
    key: "personalizedMarketing",
    label: "Personalized marketing",
    description:
      "These cookies help Lynvo personalize and measure marketing on third-party platforms.",
  },
] as const

export const CookieConsent = () => {
  const [isReady, setIsReady] = useState(false)
  const [hasSavedPreferences, setHasSavedPreferences] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [preferences, setPreferences] = useState(defaultCookiePreferences)

  useEffect(() => {
    const storedPreferences = loadCookiePreferences()

    if (storedPreferences) {
      setPreferences(storedPreferences)
    } else {
      setHasSavedPreferences(false)
    }

    setIsReady(true)
  }, [])

  useEffect(() => {
    const openPreferences = () => setIsDialogOpen(true)
    window.addEventListener(OPEN_COOKIE_PREFERENCES_EVENT, openPreferences)

    return () =>
      window.removeEventListener(OPEN_COOKIE_PREFERENCES_EVENT, openPreferences)
  }, [])

  const persistPreferences = (nextPreferences: CookiePreferences) => {
    saveCookiePreferences(nextPreferences)
    setPreferences(nextPreferences)
    setHasSavedPreferences(true)
    setIsDialogOpen(false)
  }

  const rejectNonEssential = () => persistPreferences(defaultCookiePreferences)

  const acceptAll = () =>
    persistPreferences({
      ...defaultCookiePreferences,
      analytics: true,
      marketingMeasurement: true,
      personalizedMarketing: true,
    })

  const updatePreference = (
    key: (typeof preferenceOptions)[number]["key"],
    checked: boolean
  ) => setPreferences((current) => ({ ...current, [key]: checked }))

  if (!isReady) {
    return null
  }

  return (
    <>
      {!hasSavedPreferences && (
        <section
          aria-label="Cookie consent"
          className="fixed inset-x-0 bottom-0 z-40 bg-background/70 px-5 py-7 text-foreground shadow-[0_-16px_48px_-24px_rgba(0,0,0,0.2)] backdrop-blur-xl dark:shadow-[0_-16px_48px_-24px_rgba(0,0,0,0.8)] sm:px-8 sm:py-8"
        >
          <div className="mx-auto flex max-w-[96rem] flex-col gap-6 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
            <div className="max-w-4xl">
              <h2 className="text-base font-normal text-balance">
                Lynvo uses cookies
              </h2>
              <p className="mt-3 text-xs leading-5 text-muted-foreground text-pretty">
                Lynvo uses cookies to operate this site, keep accounts secure,
                and remember preferences. Optional cookies support analytics and
                marketing when enabled. Select{" "}
                <button
                  type="button"
                  className="underline underline-offset-4 transition-opacity hover:opacity-75"
                  onClick={() => setIsDialogOpen(true)}
                >
                  Manage cookies
                </button>{" "}
                to change these choices at any time. Read the{" "}
                <Link
                  to={policyPaths.cookiePolicy}
                  className="underline underline-offset-4 transition-opacity hover:opacity-75"
                >
                  cookie policy
                </Link>{" "}
                for details about how Lynvo uses cookies.
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="h-10 px-5 text-sm active:scale-[0.96] sm:h-12"
                onClick={() => setIsDialogOpen(true)}
              >
                Manage cookies
              </Button>
              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="h-10 px-5 text-sm active:scale-[0.96] sm:h-12"
                onClick={rejectNonEssential}
              >
                Reject optional cookies
              </Button>
              <Button
                type="button"
                size="lg"
                variant="secondary"
                className="h-10 px-5 text-sm active:scale-[0.96] sm:h-12"
                onClick={acceptAll}
              >
                Accept all cookies
              </Button>
            </div>
          </div>
        </section>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent
          showCloseButton={false}
          className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl flex-col gap-0 overflow-hidden rounded-2xl bg-popover p-0 text-popover-foreground ring-1 ring-foreground/10 sm:max-w-xl"
        >
          <div className="overflow-y-auto px-5 pt-6 pb-4 sm:px-7 sm:pt-7">
            <DialogHeader className="gap-3 text-left">
              <DialogTitle className="text-xl leading-tight font-normal text-balance">
                Cookie preferences
              </DialogTitle>
              <DialogDescription className="max-w-3xl text-sm leading-6 text-muted-foreground text-pretty">
                Choose which optional cookies Lynvo can use. Cookies and similar
                identifiers store and retrieve information on this device. Lynvo
                may share some information with service providers for the
                purposes enabled here. Change these choices at any time. Read
                the{" "}
                <Link
                  to={policyPaths.cookiePolicy}
                  className="text-foreground underline underline-offset-4 hover:text-foreground/75"
                >
                  cookie policy
                </Link>
              </DialogDescription>
            </DialogHeader>

            <div className="mt-7 space-y-7">
              <label className="flex items-start gap-3">
                <Checkbox
                  checked
                  disabled
                  aria-label="Strictly necessary cookies are always enabled"
                  className="mt-0.5 disabled:opacity-100"
                />
                <span>
                  <span className="block text-sm text-foreground">
                    Strictly necessary
                  </span>
                  <span className="mt-1.5 block text-sm leading-6 text-muted-foreground">
                    These cookies are required for the site to work and can’t be
                    turned off. They support essential functions like security,
                    user authentication, and customer support.
                  </span>
                </span>
              </label>

              {preferenceOptions.map((option) => (
                <label key={option.key} className="flex items-start gap-3">
                  <Checkbox
                    checked={preferences[option.key]}
                    onCheckedChange={(checked) =>
                      updatePreference(option.key, checked)
                    }
                    aria-label={option.label}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm text-foreground">
                      {option.label}
                    </span>
                    <span className="mt-1.5 block text-sm leading-6 text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="px-5 pt-3 pb-5 sm:px-7 sm:pb-7">
            <Button
              type="button"
              className="h-10 w-full text-sm font-normal active:scale-[0.96]"
              onClick={() => persistPreferences(preferences)}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
