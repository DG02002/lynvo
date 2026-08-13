import { ArrowUpRight01Icon, Tick02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import interLatinExtendedFontUrl from "@fontsource-variable/inter/files/inter-latin-ext-wght-normal.woff2?url"
import { useEffect, useRef, useState } from "react"
import type { ComponentProps } from "react"
import { Link } from "react-router"
import type { Route } from "./+types/_site.pricing"
import { PluginIcon } from "~/components/plugin-icon"
import { buttonVariants } from "~/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table"
import { PricingFaq } from "~/features/site/pricing/pricing-faq"
import { MOBILE_PRICING_CONTROLS_HEIGHT_PX } from "~/lib/constants"
import { authPaths, policyPaths, sitePaths } from "~/lib/paths"
import { DIRECT_MEDIA_ICON } from "~/lib/plugin-icons"
import { cn } from "~/lib/utils"

const freePlanFeatures = [
  "200 Lynvo Plugin Server requests per month",
  "15 Lynvo Plugin Server requests per day",
  "1 MB of storage for up to 100 saved links",
  "Access to supported Lynvo Plugins",
  "Custom Plugin Server support",
  "Real-time sync",
  "Android player handoff and Remote Play",
]

const planCardClassName = "self-start rounded-lg"
const planCardHeaderClassName = "gap-3"
const planCardTitleClassName = "text-4xl font-normal tracking-tight"
const planCardDescriptionClassName = "text-sm text-foreground"

interface PlanDetail {
  feature: string
  allowance: string
  icon?: ComponentProps<typeof PluginIcon>["icon"]
}

const planDetailSections = [
  {
    title: "Account",
    details: [
      { feature: "Price", allowance: "₹0 per month" },
      { feature: "Account storage", allowance: "1 MB" },
      { feature: "Saved links", allowance: "Up to 100" },
      { feature: "Maximum saved-link record", allowance: "256 KB" },
      { feature: "Default saved-link retention", allowance: "30 days" },
      { feature: "Inactive account deletion", allowance: "After 90 days" },
    ],
  },
  {
    title: "Lynvo Plugin Server usage",
    details: [
      {
        feature: "Monthly requests",
        allowance: "200, shared across Lynvo Plugins and Direct Media",
      },
      { feature: "Daily requests", allowance: "15" },
      {
        feature: "Direct Media links",
        allowance: "Included",
        icon: DIRECT_MEDIA_ICON,
      },
      {
        feature: "Bhadoo’s Google Drive Index",
        allowance: "Included",
        icon: {},
      },
      {
        feature: "Google Drive Public Folders & Files",
        allowance: "Included",
        icon: {
          url: "/lynvo-plugin-server-assets/icons/sources/google-drive-public-files.webp",
        },
      },
      {
        feature: "Spencerwooo's OneDrive Vercel Index",
        allowance: "Included",
        icon: {
          url: "/lynvo-plugin-server-assets/icons/sources/onedrive-index.webp",
        },
      },
    ],
  },
  {
    title: "Plugins and Remote Play",
    details: [
      {
        feature: "Custom Plugin Server allowance",
        allowance: "Set by each Plugin Server",
      },
      { feature: "Real-time sync", allowance: "Included" },
      { feature: "Remote Play control", allowance: "Included" },
    ],
  },
] satisfies { title: string; details: PlanDetail[] }[]

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Pricing | Lynvo" },
    {
      name: "description",
      content:
        "See the current Lynvo plan, included features, storage, saved-link, and Plugin Server limits.",
    },
  ]
}

export const links: Route.LinksFunction = () => [
  {
    rel: "preload",
    href: interLatinExtendedFontUrl,
    as: "font",
    type: "font/woff2",
    crossOrigin: "anonymous",
  },
]

interface MobilePlanControlsProps {
  className?: string
}

const MobilePlanControls = ({ className }: MobilePlanControlsProps) => (
  <div className={cn("flex flex-col gap-3 sm:hidden", className)}>
    <div className="mx-auto grid w-52 max-w-full grid-cols-2 rounded-full bg-muted p-0.5 text-center text-sm">
      <span className="rounded-full bg-background px-3 py-1 shadow-sm">
        Free
      </span>
      <span className="px-3 py-1 text-foreground">More soon</span>
    </div>
    <Link
      to={authPaths.createAccount}
      viewTransition
      className={cn(buttonVariants({ size: "lg" }), "mx-auto w-full max-w-2xl")}
    >
      Get Free
      <HugeiconsIcon
        icon={ArrowUpRight01Icon}
        strokeWidth={2}
        data-icon="inline-end"
      />
    </Link>
  </div>
)

export default function Pricing() {
  const comparisonTableRef = useRef<HTMLDivElement>(null)
  const comparisonEndRef = useRef<HTMLDivElement>(null)
  const [isComparisonTableVisible, setIsComparisonTableVisible] =
    useState(false)
  const [hasComparisonEndBeenReached, setHasComparisonEndBeenReached] =
    useState(false)

  useEffect(() => {
    const comparisonTable = comparisonTableRef.current
    const comparisonEnd = comparisonEndRef.current

    if (!comparisonTable || !comparisonEnd) {
      return
    }

    const tableObserver = new IntersectionObserver(([entry]) => {
      setIsComparisonTableVisible(entry.isIntersecting)
    })
    const endObserver = new IntersectionObserver(
      ([entry]) => {
        const observerBottom =
          entry.rootBounds?.bottom ??
          window.innerHeight - MOBILE_PRICING_CONTROLS_HEIGHT_PX

        setHasComparisonEndBeenReached(
          entry.boundingClientRect.top <= observerBottom
        )
      },
      {
        rootMargin: `0px 0px -${MOBILE_PRICING_CONTROLS_HEIGHT_PX}px 0px`,
      }
    )

    tableObserver.observe(comparisonTable)
    endObserver.observe(comparisonEnd)

    return () => {
      tableObserver.disconnect()
      endObserver.disconnect()
    }
  }, [])

  const isMobileComparisonControlVisible =
    isComparisonTableVisible && !hasComparisonEndBeenReached

  return (
    <div className="w-full px-6 py-16 md:px-8 md:py-24 lg:px-10 xl:px-14">
      <header className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
        <p className="text-sm">Lynvo</p>
        <h1 className="my-4 text-4xl font-normal tracking-tight text-balance md:text-6xl">
          Pricing
        </h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Lynvo currently offers a Free plan. Review its features and limits.
        </p>
      </header>

      <section
        aria-label="Available plans"
        className="mx-auto mt-14 grid max-w-5xl items-start gap-5 lg:grid-cols-2"
      >
        <Card className={cn(planCardClassName, "border-foreground/20")}>
          <CardHeader className={planCardHeaderClassName}>
            <CardTitle className={planCardTitleClassName}>Free</CardTitle>
            <CardDescription className={planCardDescriptionClassName}>
              For saving links and opening them in Android players on Android
              TV, Android phones, and Android tablets.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-8">
            <div className="flex items-baseline gap-2">
              <span className="text-6xl font-normal tracking-tight">₹0</span>
              <span className="text-lg text-muted-foreground">/ month</span>
            </div>
            <Link
              to={authPaths.createAccount}
              viewTransition
              className={cn(buttonVariants({ size: "lg" }), "w-full")}
            >
              Create a free account
              <HugeiconsIcon
                icon={ArrowUpRight01Icon}
                strokeWidth={2}
                data-icon="inline-end"
              />
            </Link>
            <ul className="flex flex-col gap-5">
              {freePlanFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-4">
                  <HugeiconsIcon
                    icon={Tick02Icon}
                    strokeWidth={2}
                    className="mt-0.5 size-5 shrink-0"
                  />
                  <span className="text-sm leading-6">{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
          <CardFooter className="sr-only">
            The Free plan is available now.
          </CardFooter>
        </Card>

        <Card
          className={cn(
            planCardClassName,
            "rounded-none bg-transparent ring-0"
          )}
        >
          <CardHeader className={planCardHeaderClassName}>
            <CardTitle className={planCardTitleClassName}>More plans</CardTitle>
            <CardDescription className={planCardDescriptionClassName}>
              Coming soon.
            </CardDescription>
          </CardHeader>
          <CardFooter className="sr-only">
            Additional plans are coming soon.
          </CardFooter>
        </Card>
      </section>

      <section className="mx-auto mt-24 max-w-3xl">
        <header className="flex flex-col gap-3 text-center">
          <h2 className="text-3xl font-normal tracking-tight md:text-4xl">
            Compare features across plans
          </h2>
        </header>

        <div ref={comparisonTableRef} className="mt-12">
          <div className="sticky top-16 z-20 hidden grid-cols-[60%_40%] items-end bg-background py-4 sm:grid">
            <div aria-hidden="true" />
            <div className="flex flex-col items-start gap-3">
              <span className="text-lg">Free</span>
              <Link
                to={authPaths.createAccount}
                viewTransition
                className={buttonVariants({ size: "sm" })}
              >
                Create a free account
                <HugeiconsIcon
                  icon={ArrowUpRight01Icon}
                  strokeWidth={2}
                  data-icon="inline-end"
                />
              </Link>
            </div>
          </div>
          <Table className="table-fixed">
            <colgroup>
              <col className="w-[58%] sm:w-3/5" />
              <col className="w-[42%] sm:w-2/5" />
            </colgroup>
            <TableHeader className="sr-only">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-3/5 px-0 text-base">Feature</TableHead>
                <TableHead className="px-0 text-base">Free</TableHead>
              </TableRow>
            </TableHeader>
            {planDetailSections.map((section) => (
              <TableBody key={section.title}>
                <TableRow className="border-b-0 hover:bg-transparent">
                  <TableCell
                    colSpan={2}
                    className="px-0 pt-12 pb-4 text-2xl font-normal"
                  >
                    {section.title}
                  </TableCell>
                </TableRow>
                {section.details.map(({ feature, allowance, icon }) => (
                  <TableRow key={feature} className="hover:bg-transparent">
                    <TableCell className="py-5 pr-4 pl-0 font-medium whitespace-normal sm:pr-6">
                      <span className="flex min-w-0 items-center gap-2.5">
                        {icon && (
                          <PluginIcon
                            icon={icon}
                            fallback="source"
                            className="size-6 shrink-0"
                          />
                        )}
                        <span className="min-w-0 text-pretty">{feature}</span>
                      </span>
                    </TableCell>
                    <TableCell className="py-5 pr-0 pl-4 whitespace-normal text-muted-foreground sm:pl-6">
                      {allowance}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            ))}
          </Table>

          <div ref={comparisonEndRef} className="h-px sm:hidden" />
          {isMobileComparisonControlVisible && (
            <div
              className="flow-root sm:hidden"
              style={{ height: MOBILE_PRICING_CONTROLS_HEIGHT_PX }}
            >
              <MobilePlanControls className="fixed inset-x-0 bottom-0 z-40 bg-background px-6 pt-4 pb-4" />
            </div>
          )}
        </div>

        <footer className="mx-auto mt-12 flex max-w-3xl flex-col items-center gap-4 text-center text-sm italic leading-6 text-muted-foreground">
          <p>
            The Free plan includes the storage, saved-link, daily, and monthly
            limits listed on this page. Automated or abusive use may be
            restricted under the{" "}
            <Link
              to={policyPaths.usagePolicy}
              viewTransition
              className="text-foreground underline underline-offset-4"
            >
              Usage policy
            </Link>
            .
          </p>
          <p>
            Custom Plugin Server limits are set and enforced by each Plugin
            Server.
          </p>
          <p>
            Plan limits may change as Lynvo develops. Material changes appear in
            the{" "}
            <Link
              to={sitePaths.changelog}
              viewTransition
              className="text-foreground underline underline-offset-4"
            >
              changelog
            </Link>
            .
          </p>
        </footer>
      </section>

      <PricingFaq />
    </div>
  )
}
