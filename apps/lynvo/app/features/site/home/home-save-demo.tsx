import { useEffect, useState } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight02Icon,
  ClipboardPasteIcon,
  Folder01Icon,
  LockIcon,
  PackageSearchIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons"
import { NewBadge } from "~/components/save-list/new-badge"
import {
  HOME_DEMO_BROWSER_URL,
  HOME_DEMO_CLIPBOARD_URL,
  HOME_DEMO_FINAL_STEP,
  HOME_DEMO_INITIAL_DELAY_MS,
  HOME_DEMO_RESET_INTERVAL_MS,
  HOME_DEMO_STEP_INTERVAL_MS,
  REDUCED_MOTION_MEDIA_QUERY,
} from "./home-demo-constants"

interface HomeDemoItem {
  icon: typeof PlayIcon
  title: string
  detail: string
  meta?: string
  isNew?: boolean
  accent?: boolean
}

const HOME_DEMO_ITEMS: HomeDemoItem[] = [
  {
    icon: PlayIcon,
    title: "Midnight Relay — Episode 06 · 1080p",
    detail: "Direct video",
    accent: true,
  },
  {
    icon: PackageSearchIcon,
    title: "The Glass Frontier — Chapter 12 · 1080p",
    detail: "Cloud extractor",
    meta: "2.4 GB",
  },
  {
    icon: Folder01Icon,
    title: "Northstar Files — Season 01",
    detail: "Open collection",
    meta: "8 items",
  },
]

const CREATED_HOME_DEMO_ITEM: HomeDemoItem = {
  icon: PlayIcon,
  title: "Aurora Station — Episode 03 · 1080p",
  detail: "Saved just now",
  isNew: true,
  accent: true,
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

    const delay =
      step === 0
        ? HOME_DEMO_INITIAL_DELAY_MS
        : step === HOME_DEMO_FINAL_STEP
          ? HOME_DEMO_RESET_INTERVAL_MS
          : HOME_DEMO_STEP_INTERVAL_MS
    const nextStep = step === HOME_DEMO_FINAL_STEP ? 0 : step + 1
    const timeout = window.setTimeout(() => setStep(nextStep), delay)

    return () => window.clearTimeout(timeout)
  }, [isReducedMotion, step])

  const isClipboardOpen = step >= 2 && step < 4
  const isLinkPasted = step >= 3
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
            <HugeiconsIcon icon={LockIcon} className="size-3.5" />
            <span className="truncate">{HOME_DEMO_BROWSER_URL}</span>
          </div>

          <span className="hidden min-w-14 text-right text-xs text-muted-foreground sm:block">
            Lynvo
          </span>
        </div>

        <div className="relative p-4 sm:p-7">
          <div className="relative z-20 mx-auto mb-6 flex w-full flex-col gap-3">
            <div className="relative">
              <div className="flex h-13.5 w-full items-center rounded-full bg-muted/35 px-5 pr-14 text-left shadow-[inset_0_0_0_1px_rgba(0,0,0,0.09),0_1px_2px_rgba(0,0,0,0.03)] transition-[box-shadow,background-color] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]">
                <span
                  className={
                    isLinkPasted
                      ? "truncate text-sm text-foreground sm:text-base"
                      : "text-sm text-muted-foreground sm:text-base"
                  }
                >
                  {isLinkPasted
                    ? HOME_DEMO_CLIPBOARD_URL
                    : "Paste a video link"}
                </span>
              </div>

              <span
                className={`absolute top-1.25 right-1.25 flex size-11 items-center justify-center rounded-full bg-foreground text-background transition-opacity ${isLinkPasted ? "opacity-100" : "opacity-35"}`}
              >
                <HugeiconsIcon
                  icon={ArrowRight02Icon}
                  strokeWidth={2}
                  className="size-6"
                />
              </span>

              <div
                className={`home-demo-clipboard absolute top-[calc(100%+0.5rem)] left-3 z-30 flex w-[min(24rem,calc(100%-1.5rem))] items-center gap-3 rounded-[14px] bg-popover p-3 text-left shadow-[0_10px_30px_-8px_rgba(0,0,0,0.28),0_0_0_1px_rgba(0,0,0,0.08)] transition-[opacity,transform,filter] dark:shadow-[0_16px_36px_-10px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.12)] ${isClipboardOpen ? "pointer-events-auto translate-y-0 scale-100 opacity-100 blur-0" : "pointer-events-none -translate-y-1 scale-[0.97] opacity-0 blur-[4px]"}`}
                aria-hidden={!isClipboardOpen}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-[9px] bg-muted">
                  <HugeiconsIcon icon={ClipboardPasteIcon} className="size-5" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs text-muted-foreground">
                    From clipboard
                  </span>
                  <span className="block truncate text-sm">
                    aurora-station-1080p.mp4
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col overflow-hidden rounded-[12px] bg-background shadow-[0_0_0_1px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1)]">
            <div
              className={`home-demo-created-item grid transition-[grid-template-rows,opacity] ${isItemCreated ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
              aria-hidden={!isItemCreated}
            >
              <div className="min-h-0">
                <DemoLibraryItem item={CREATED_HOME_DEMO_ITEM} />
              </div>
            </div>
            {HOME_DEMO_ITEMS.map((item) => (
              <DemoLibraryItem key={item.title} item={item} />
            ))}
          </div>

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
      <p className="mt-4 text-center text-xs text-muted-foreground">
        A link becomes a synced item in seconds
      </p>
    </div>
  )
}

const DemoLibraryItem = ({ item }: { item: HomeDemoItem }) => (
  <div
    className={`flex min-h-20 w-full items-center gap-3 px-4 py-4 shadow-[inset_0_-1px_rgba(0,0,0,0.07)] last:shadow-none dark:shadow-[inset_0_-1px_rgba(255,255,255,0.08)] ${item.accent ? "bg-sky-500/10" : ""}`}
  >
    <span className="flex size-11 shrink-0 items-center justify-center rounded-[9px] bg-muted/70 text-foreground">
      <HugeiconsIcon icon={item.icon} className="size-5" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block truncate text-sm sm:text-base">{item.title}</span>
      <span className="block truncate text-xs text-muted-foreground">
        {item.detail}
      </span>
    </span>
    {item.meta && (
      <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
        {item.meta}
      </span>
    )}
    {item.isNew && <NewBadge />}
  </div>
)
