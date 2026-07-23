import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight02Icon,
  Folder01Icon,
  PackageSearchIcon,
  PlayIcon,
} from "@hugeicons/core-free-icons"
import { NewBadge } from "~/components/save-list/new-badge"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "~/components/ui/input-group"

export const HomeHero = () => {
  return (
    <section className="relative flex min-h-[90vh] w-full flex-col items-center justify-center overflow-hidden bg-background px-0 pt-32 pb-20 lg:pt-36">
      {/* Vercel-style ambient glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-50 dark:opacity-30">
        <div className="h-[40rem] w-[40rem] rounded-full bg-primary/10 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center gap-10 px-4 sm:px-6">
        {/* Massive Typography */}
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="t-stagger-line t-stagger-line--2 mt-8 max-w-4xl text-balance text-5xl font-normal tracking-[-0.04em] md:text-7xl lg:text-[5.5rem] lg:leading-[0.95]">
            Save it here. Watch it on Android.
          </h1>
          <p className="t-stagger-line t-stagger-line--3 mt-2 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Lynvo turns video links into a clean, synced library and opens them
            in the Android player that fits the link—on Android TV, phone, or
            tablet.
          </p>
        </div>

        {/* Static save preview: intentionally has no clipboard or form access. */}
        <div className="t-stagger-line t-stagger-line--4 mt-12 flex w-full max-w-3xl flex-col rounded-[16px] bg-background/50 shadow-[0_2px_2px_rgba(0,0,0,0.04),0_8px_16px_-4px_rgba(0,0,0,0.04),0_24px_32px_-8px_rgba(0,0,0,0.06)] ring-1 ring-border backdrop-blur-xl dark:bg-background/80 dark:shadow-none p-4 sm:p-8">
          <div
            className="pointer-events-none mx-auto mb-8 flex w-full flex-col gap-4"
            aria-label="Save page preview"
          >
            <div className="overflow-hidden">
              <div className="w-full rounded-md px-1 py-2 text-left">
                <span className="shimmer shimmer-color-blue-500/60 shimmer-duration-6000 shimmer-spread-24 block max-w-full truncate text-base font-normal text-primary">
                  https://media.example/playable-item.mp4
                </span>
              </div>
            </div>

            <InputGroup className="w-full h-13.5 rounded-full bg-muted/30 sm:flex-1 border-2 border-default-medium">
              <InputGroupInput
                placeholder="Paste link"
                className="text-base text-heading pl-5"
                value=""
                readOnly
                tabIndex={-1}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="button"
                  size="icon-xs"
                  title="Save link"
                  aria-label="Save link"
                  variant="default"
                  className="size-11 rounded-full"
                  tabIndex={-1}
                >
                  <HugeiconsIcon
                    icon={ArrowRight02Icon}
                    strokeWidth={2}
                    className="size-6"
                  />
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>

          <div className="flex flex-col border-t border-border">
            <div className="flex flex-col">
              <div className="flex min-h-24 w-full items-center gap-3 border-b bg-sky-500/15 px-4 py-6">
                <span className="flex size-14 shrink-0 items-center justify-center text-foreground">
                  <HugeiconsIcon icon={PlayIcon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block line-clamp-3 break-words text-sm md:text-lg">
                    Playable Item Alpha
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    Direct video
                  </span>
                </span>
              </div>

              <div className="flex min-h-24 w-full items-center gap-3 border-b px-4 py-6">
                <span className="flex size-14 shrink-0 items-center justify-center text-foreground">
                  <HugeiconsIcon icon={PackageSearchIcon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block line-clamp-3 break-words text-sm md:text-lg">
                    Playable Item Beta
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    Extractor Source Beta
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  8.4 GB
                </span>
                <NewBadge />
              </div>

              <div className="flex min-h-24 w-full items-center gap-3 px-4 py-6">
                <span className="flex size-14 shrink-0 items-center justify-center text-foreground">
                  <HugeiconsIcon icon={Folder01Icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block line-clamp-3 break-words text-sm md:text-lg">
                    Open Collection Directory
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    Open Collection
                  </span>
                </span>
                <NewBadge />
                <span className="shrink-0 text-xs text-muted-foreground">
                  12 items
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
