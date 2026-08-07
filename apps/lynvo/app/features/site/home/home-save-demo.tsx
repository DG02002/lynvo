import { useEffect, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  ArrowRight02Icon,
  EllipsisIcon,
  Folder01Icon,
  PackageSearchIcon,
  PlayIcon,
  Shield01Icon,
} from "@hugeicons/core-free-icons"
import { NewBadge } from "~/components/save-list/new-badge"
import { Spinner } from "~/components/ui/spinner"
import {
  HOME_DEMO_BROWSER_URL,
  HOME_DEMO_CLIPBOARD_URL,
  HOME_DEMO_FINAL_STEP,
  HOME_DEMO_STEP_DELAYS_MS,
  REDUCED_MOTION_MEDIA_QUERY,
} from "./home-demo-constants"

interface HomeDemoItem {
  icon: typeof PlayIcon
  title: string
  detail: string
  meta?: string
  isNew?: boolean
  isOpened?: boolean
  isFolder?: boolean
}

const HOME_DEMO_ITEMS: HomeDemoItem[] = [
  {
    icon: PlayIcon,
    title: "Midnight Relay — Episode 06 · 1080p",
    detail: "Direct Media",
    isOpened: true,
  },
  {
    icon: PackageSearchIcon,
    title: "The Glass Frontier — Chapter 12 · 1080p",
    detail: "Lynvo Plugin Server",
    meta: "2.4 GB",
  },
  {
    icon: Folder01Icon,
    title: "Northstar Files — Season 01",
    detail: "Open collection",
    meta: "8 items",
    isFolder: true,
  },
]

const CREATED_HOME_DEMO_ITEM: HomeDemoItem = {
  icon: PlayIcon,
  title: "Aurora Station — Episode 03 · 1080p",
  detail: "Saved just now",
  isNew: true,
}

export const HomeSaveDemo = () => {
  const [step, setStep] = useState(0)
  const [isReducedMotion, setIsReducedMotion] = useState(false)

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_MEDIA_QUERY)
    const updateReducedMotion = () => {
      setIsReducedMotion(reducedMotionQuery.matches)
      if (reducedMotionQuery.matches) {
        setStep(HOME_DEMO_FINAL_STEP)
      }
    }

    updateReducedMotion()
    reducedMotionQuery.addEventListener("change", updateReducedMotion)

    return () =>
      reducedMotionQuery.removeEventListener("change", updateReducedMotion)
  }, [])

  useEffect(() => {
    if (isReducedMotion) {
      return
    }

    const delay = HOME_DEMO_STEP_DELAYS_MS[step]
    const nextStep = step === HOME_DEMO_FINAL_STEP ? 0 : step + 1
    const timeout = window.setTimeout(() => setStep(nextStep), delay)

    return () => window.clearTimeout(timeout)
  }, [isReducedMotion, step])

  const isClipboardOpen = step >= 3 && step < 5
  const isLinkPasted = step >= 5
  const isSaving = step === 5
  const isItemCreated = step >= HOME_DEMO_FINAL_STEP

  return (
    <div
      className="home-save-demo pointer-events-none t-stagger-line t-stagger-line--4 mt-12 w-full max-w-4xl select-none"
      data-step={step}
      aria-label="Animated preview of saving a video link to Lynvo"
    >
      <div className="overflow-hidden rounded-[18px] bg-background/95 shadow-[0_2px_3px_rgba(0,0,0,0.05),0_16px_40px_-12px_rgba(0,0,0,0.18),0_36px_80px_-24px_rgba(0,0,0,0.2)] ring-1 ring-black/10 backdrop-blur-xl dark:bg-background/90 dark:shadow-[0_2px_3px_rgba(0,0,0,0.4),0_24px_70px_-20px_rgba(0,0,0,0.9)] dark:ring-white/10">
        <div className="flex h-12 items-center gap-3 bg-muted/65 px-4 shadow-[inset_0_-1px_rgba(0,0,0,0.08)] dark:bg-muted/35 dark:shadow-[inset_0_-1px_rgba(255,255,255,0.08)]">
          <div className="flex shrink-0 items-center gap-2" aria-hidden="true">
            <span className="size-3 rounded-full bg-[#ff5f57] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.18)]" />
            <span className="size-3 rounded-full bg-[#febc2e] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.18)]" />
            <span className="size-3 rounded-full bg-[#28c840] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.18)]" />
          </div>

          <div className="mx-auto flex h-8 w-full max-w-md items-center justify-center gap-2 rounded-[9px] bg-background/80 px-3 text-xs text-muted-foreground shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.04)] dark:bg-black/35 dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
            <HugeiconsIcon icon={Shield01Icon} className="size-3.5" />
            <span className="truncate">{HOME_DEMO_BROWSER_URL}</span>
          </div>

          <span className="hidden min-w-14 sm:block" aria-hidden="true" />
        </div>

        <div className="relative px-4 py-7 sm:px-8 sm:py-10">
          <div className="relative z-20 mx-auto mb-8 flex w-full flex-col gap-4">
            <div
              aria-hidden={!isClipboardOpen}
              className={`home-demo-clipboard-reveal transition-[opacity,transform,filter] duration-500 motion-reduce:transition-none ${isClipboardOpen ? "translate-y-0 opacity-100 blur-0" : "-translate-y-1 opacity-0 blur-[4px]"}`}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="w-full rounded-md px-1 py-2 text-left">
                  <span className="shimmer shimmer-color-blue-500/60 shimmer-duration-6000 shimmer-spread-24 block max-w-full truncate text-base font-normal text-primary">
                    {HOME_DEMO_CLIPBOARD_URL}
                  </span>
                </div>
              </div>
            </div>

            <div className="relative">
              <div
                className={`flex h-13.5 w-full items-center rounded-full border-2 bg-muted/30 px-5 pr-14 text-left transition-colors ${step >= 1 && step < 5 ? "border-blue-500" : "border-default-medium"}`}
              >
                <span
                  className={
                    isLinkPasted
                      ? "truncate text-sm text-foreground sm:text-base"
                      : "text-sm text-muted-foreground sm:text-base"
                  }
                >
                  {isLinkPasted ? HOME_DEMO_CLIPBOARD_URL : "Paste link"}
                </span>
              </div>

              <span
                className={`absolute top-1.25 right-1.25 flex size-11 items-center justify-center rounded-full bg-foreground text-background transition-opacity ${isLinkPasted ? "opacity-100" : "opacity-35"}`}
              >
                {isSaving ? (
                  <Spinner className="size-6" aria-label="Saving demo link…" />
                ) : (
                  <HugeiconsIcon
                    icon={ArrowRight02Icon}
                    strokeWidth={2}
                    className="size-6"
                  />
                )}
              </span>
            </div>
          </div>

          <section className="border-t">
            <div
              className={`home-demo-created-item transition-opacity ${isItemCreated ? "opacity-100" : "opacity-0"}`}
              aria-hidden={!isItemCreated}
            >
              <div className="min-h-0">
                <DemoLibraryItem item={CREATED_HOME_DEMO_ITEM} />
              </div>
            </div>
            {HOME_DEMO_ITEMS.map((item) => (
              <DemoLibraryItem key={item.title} item={item} />
            ))}
          </section>

          <svg
            className="home-demo-cursor pointer-events-none absolute z-40 h-7 w-7 drop-shadow-[0_2px_2px_rgba(0,0,0,0.25)]"
            viewBox="0 0 28 28"
            aria-hidden="true"
          >
            <path
              d="M5 3.5 22.1 17l-8.4 1.2-4.6 7.1L5 3.5Z"
              fill="white"
              stroke="black"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  )
}

const DemoLibraryItem = ({ item }: { item: HomeDemoItem }) => (
  <div className="border-b last:border-b-0">
    <div
      className={`flex min-h-24 w-full items-center gap-3 px-4 py-6 ${item.isOpened ? "bg-sky-500/15" : ""}`}
    >
      <span className="flex size-14 shrink-0 items-center justify-center text-foreground">
        <HugeiconsIcon icon={item.icon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block line-clamp-3 break-words text-sm font-normal md:text-lg">
          {item.title}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {item.detail}
        </span>
      </span>
      {item.isNew && <NewBadge />}
      {item.meta && (
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
          {item.meta}
        </span>
      )}
      <HugeiconsIcon
        icon={EllipsisIcon}
        className="size-6 shrink-0 text-foreground"
      />
      {item.isFolder && (
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          className="shrink-0 text-foreground"
        />
      )}
    </div>
  </div>
)
