import {
  ArrowUpRight01Icon,
  Link01Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
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
import { authPaths, policyPaths, sitePaths } from "~/lib/paths"
import { cn } from "~/lib/utils"

const freePlanFeatures = [
  "Limited official extraction",
  "Limited saved-link storage",
  "Access to all official sources",
  "External extractor support",
  "Real-time sync",
  "Android playback and remote control",
]

const planCardClassName = "self-start rounded-lg"
const planCardHeaderClassName = "gap-3"
const planCardTitleClassName = "text-4xl font-normal tracking-tight"
const planCardDescriptionClassName = "text-sm text-foreground"
const planCardBodyTextClassName =
  "max-w-md text-sm leading-6 text-muted-foreground"

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
      { feature: "Account storage", allowance: "3 MB" },
      { feature: "Saved links", allowance: "Up to 100" },
      { feature: "Maximum saved-link record", allowance: "1 MB" },
      { feature: "Default saved-link retention", allowance: "90 days" },
      { feature: "Inactive account deletion", allowance: "After 90 days" },
    ],
  },
  {
    title: "Official extraction",
    details: [
      {
        feature: "Official extractions",
        allowance: "200 per month, shared",
      },
      { feature: "Daily extraction limit", allowance: "15 per day" },
      {
        feature: "Direct links",
        allowance: "Included",
        icon: { hugeIcon: Link01Icon },
      },
      {
        feature: "Bhadoo’s Google Drive Index",
        allowance: "Included",
        icon: {},
      },
      {
        feature: "Google Drive Public Files",
        allowance: "Included",
        icon: {
          url: "/official-extractor-assets/icons/sources/google-drive-public-files.webp",
        },
      },
      {
        feature: "Spencerwooo's OneDrive Vercel Index",
        allowance: "Included",
        icon: {
          url: "/official-extractor-assets/icons/sources/onedrive-index.webp",
        },
      },
    ],
  },
  {
    title: "Plugins and devices",
    details: [
      {
        feature: "External extractor allowance",
        allowance: "Set by each extractor",
      },
      { feature: "Real-time sync", allowance: "Included" },
      { feature: "Remote playback control", allowance: "Included" },
    ],
  },
] satisfies { title: string; details: PlanDetail[] }[]

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Pricing | Lynvo" },
    {
      name: "description",
      content:
        "See the current Lynvo plan, included features, storage, and extraction limits.",
    },
  ]
}

export default function Pricing() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-16 md:px-8 md:py-24">
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
              For saving, extracting, and playing supported links.
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
              Get Free
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
              Not available yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-1 flex-col gap-4">
            <p className={planCardBodyTextClassName}>
              Plans with higher limits may be added as Lynvo grows.
            </p>
          </CardContent>
          <CardFooter className="sr-only">
            Additional plans are not available.
          </CardFooter>
        </Card>
      </section>

      <section className="mx-auto mt-24 max-w-3xl">
        <header className="flex flex-col gap-3 text-center">
          <h2 className="text-3xl font-normal tracking-tight md:text-4xl">
            Compare features across plans
          </h2>
        </header>

        <div className="mt-12">
          <div className="sticky top-16 z-20 grid grid-cols-[60%_40%] items-end bg-background py-4">
            <div aria-hidden="true" />
            <div className="flex flex-col items-start gap-3">
              <span className="text-lg">Free</span>
              <Link
                to={authPaths.createAccount}
                viewTransition
                className={buttonVariants({ size: "sm" })}
              >
                Get Free
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
              <col className="w-3/5" />
              <col className="w-2/5" />
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
                    <TableCell className="px-0 py-5 font-medium whitespace-normal">
                      <span className="flex items-center gap-2.5">
                        {icon && (
                          <PluginIcon
                            icon={icon}
                            fallback="source"
                            className="size-6"
                          />
                        )}
                        <span>{feature}</span>
                      </span>
                    </TableCell>
                    <TableCell className="px-0 py-5 whitespace-normal text-muted-foreground">
                      {allowance}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            ))}
          </Table>
        </div>

        <footer className="mx-auto mt-12 flex max-w-3xl flex-col items-center gap-4 text-center text-sm italic leading-6 text-muted-foreground">
          <p>
            Usage must remain reasonable and comply with the{" "}
            <Link
              to={policyPaths.usagePolicy}
              viewTransition
              className="text-foreground underline underline-offset-4"
            >
              Usage Policies
            </Link>
            .
          </p>
          <p>
            External extractor limits are set and enforced by each extractor.
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
    </main>
  )
}
