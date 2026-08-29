import {
  useEffect,
  useRef,
  useState,
  type ComponentProps,
  type RefObject,
} from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowRight01Icon,
  ArrowRight02Icon,
  ArrowUpRight01Icon,
  CopyIcon,
  Delete02Icon,
  EllipsisIcon,
  Folder01Icon,
  PackageSearchIcon,
  PlayIcon,
  Shield01Icon,
} from "@hugeicons/core-free-icons"
import { NewBadge } from "~/components/save-list/new-badge"
import { Button } from "~/components/ui/button"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "~/components/ui/input-group"
import { Spinner } from "~/components/spinner"
import {
  HOME_DEMO_BROWSER_URL,
  HOME_DEMO_CLIPBOARD_URL,
  HOME_DEMO_CURSOR_TIP_OFFSET_X_PX,
  HOME_DEMO_CURSOR_TIP_OFFSET_Y_PX,
  HOME_DEMO_FINAL_STEP,
  HOME_DEMO_STEP,
  HOME_DEMO_STEP_DELAYS_MS,
  REDUCED_MOTION_MEDIA_QUERY,
} from "./home-demo-constants"
import { useAnimationActivity } from "./use-animation-activity"

interface HomeDemoItem {
  icon: typeof PlayIcon
  title: string
  detail: string
  meta?: string
  isNew?: boolean
  isOpened?: boolean
  isFolder?: boolean
}

interface HomeDemoCursorPosition {
  left: number
  top: number
}

interface DemoLibraryItemProps {
  item: HomeDemoItem
  menuTriggerRef?: RefObject<HTMLButtonElement | null>
  isMenuTriggerPressed?: boolean
}

interface DemoMenuItemProps {
  icon: ComponentProps<typeof HugeiconsIcon>["icon"]
  label: string
  itemRef?: RefObject<HTMLDivElement | null>
  isDestructive?: boolean
  isHighlighted?: boolean
  showArrow?: boolean
}

const getDemoMenuItemTextClassName = (isDestructive: boolean) =>
  isDestructive ? "text-destructive" : "text-popover-foreground"

const getDemoMenuItemHighlightClassName = (
  isDestructive: boolean,
  isHighlighted: boolean
) => {
  if (!isHighlighted) {
    return ""
  }

  if (isDestructive) {
    return "bg-destructive/10"
  }

  return "bg-accent"
}

interface DemoLinkMenuProps {
  removeMenuItemRef: RefObject<HTMLDivElement | null>
  isRemoveMenuItemFocused: boolean
}

interface DemoRemoveDialogProps {
  confirmButtonRef: RefObject<HTMLButtonElement | null>
  isConfirmButtonPressed: boolean
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
  detail: "Direct Media",
  isNew: true,
}

export const HomeSaveDemo = () => {
  const [step, setStep] = useState<number>(HOME_DEMO_STEP.READY)
  const [isReducedMotion, setIsReducedMotion] = useState(false)
  const [cursorPosition, setCursorPosition] =
    useState<HomeDemoCursorPosition | null>(null)
  const { animationContainerRef: demoStageRef, isAnimationActive } =
    useAnimationActivity<HTMLDivElement>()
  const copySourceRef = useRef<HTMLButtonElement>(null)
  const clipboardRef = useRef<HTMLButtonElement>(null)
  const menuTriggerRef = useRef<HTMLButtonElement>(null)
  const removeMenuItemRef = useRef<HTMLDivElement>(null)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const reducedMotionQuery = window.matchMedia(REDUCED_MOTION_MEDIA_QUERY)
    const updateReducedMotion = () => {
      setIsReducedMotion(reducedMotionQuery.matches)
      if (reducedMotionQuery.matches) {
        setStep(HOME_DEMO_STEP.ITEM_CREATED)
      }
    }

    updateReducedMotion()
    reducedMotionQuery.addEventListener("change", updateReducedMotion)

    return () =>
      reducedMotionQuery.removeEventListener("change", updateReducedMotion)
  }, [])

  useEffect(() => {
    if (isReducedMotion || !isAnimationActive) {
      return
    }

    const delay = HOME_DEMO_STEP_DELAYS_MS[step]
    const nextStep =
      step === HOME_DEMO_FINAL_STEP ? HOME_DEMO_STEP.READY : step + 1
    const timeout = window.setTimeout(() => setStep(nextStep), delay)

    return () => window.clearTimeout(timeout)
  }, [isAnimationActive, isReducedMotion, step])

  const isClipboardOpen =
    step === HOME_DEMO_STEP.CLIPBOARD_VISIBLE ||
    step === HOME_DEMO_STEP.PASTE_CLIPBOARD_LINK
  const isLinkPasted = step === HOME_DEMO_STEP.SAVING_LINK
  const isSaving = step === HOME_DEMO_STEP.SAVING_LINK
  const isItemCreated =
    step >= HOME_DEMO_STEP.ITEM_CREATED && step < HOME_DEMO_STEP.REMOVED
  const isMenuOpen =
    step >= HOME_DEMO_STEP.OPEN_ITEM_MENU &&
    step < HOME_DEMO_STEP.OPEN_REMOVE_DIALOG
  const isRemoveDialogOpen =
    step >= HOME_DEMO_STEP.OPEN_REMOVE_DIALOG && step < HOME_DEMO_STEP.REMOVED
  const isCopySourceVisible = step <= HOME_DEMO_STEP.COPY_SOURCE_LINK
  const isCopySourcePressed = step === HOME_DEMO_STEP.COPY_SOURCE_LINK
  const isClipboardPressed = step === HOME_DEMO_STEP.PASTE_CLIPBOARD_LINK
  const isMenuTriggerPressed = step === HOME_DEMO_STEP.OPEN_ITEM_MENU
  const isRemoveMenuItemFocused =
    step === HOME_DEMO_STEP.MOVE_TO_REMOVE_LINK ||
    step === HOME_DEMO_STEP.REMOVE_LINK
  const isRemoveMenuItemPressed = step === HOME_DEMO_STEP.REMOVE_LINK
  const isConfirmButtonPressed = step === HOME_DEMO_STEP.CONFIRM_REMOVE
  const isCursorPressed =
    isCopySourcePressed ||
    isClipboardPressed ||
    isMenuTriggerPressed ||
    isRemoveMenuItemPressed ||
    isConfirmButtonPressed
  const visibleHomeDemoItems = isItemCreated
    ? [CREATED_HOME_DEMO_ITEM, ...HOME_DEMO_ITEMS.slice(0, -1)]
    : HOME_DEMO_ITEMS

  const handleCopySourceClick = () => {
    if (step <= HOME_DEMO_STEP.COPY_SOURCE_LINK) {
      setStep(HOME_DEMO_STEP.CLIPBOARD_VISIBLE)
    }
  }

  const handleClipboardClick = () => {
    if (step === HOME_DEMO_STEP.CLIPBOARD_VISIBLE) {
      setStep(HOME_DEMO_STEP.PASTE_CLIPBOARD_LINK)
    }
  }

  useEffect(() => {
    let cursorTarget: HTMLElement | null = null

    if (
      step === HOME_DEMO_STEP.MOVE_TO_COPY_SOURCE ||
      step === HOME_DEMO_STEP.COPY_SOURCE_LINK
    ) {
      cursorTarget = copySourceRef.current
    } else if (
      step === HOME_DEMO_STEP.CLIPBOARD_VISIBLE ||
      step === HOME_DEMO_STEP.PASTE_CLIPBOARD_LINK
    ) {
      cursorTarget = clipboardRef.current
    } else if (
      step === HOME_DEMO_STEP.ITEM_CREATED ||
      step === HOME_DEMO_STEP.OPEN_ITEM_MENU
    ) {
      cursorTarget = menuTriggerRef.current
    } else if (
      step === HOME_DEMO_STEP.MOVE_TO_REMOVE_LINK ||
      step === HOME_DEMO_STEP.REMOVE_LINK
    ) {
      cursorTarget = removeMenuItemRef.current
    } else if (
      step === HOME_DEMO_STEP.OPEN_REMOVE_DIALOG ||
      step === HOME_DEMO_STEP.CONFIRM_REMOVE
    ) {
      cursorTarget = confirmButtonRef.current
    }

    const demoStage = demoStageRef.current
    if (!cursorTarget || !demoStage) {
      return
    }

    const updateCursorPosition = () => {
      const stageRect = demoStage.getBoundingClientRect()
      const targetRect = cursorTarget.getBoundingClientRect()
      setCursorPosition({
        left:
          targetRect.left -
          stageRect.left +
          targetRect.width / 2 -
          HOME_DEMO_CURSOR_TIP_OFFSET_X_PX,
        top:
          targetRect.top -
          stageRect.top +
          targetRect.height / 2 -
          HOME_DEMO_CURSOR_TIP_OFFSET_Y_PX,
      })
    }

    updateCursorPosition()
    window.addEventListener("resize", updateCursorPosition)

    return () => window.removeEventListener("resize", updateCursorPosition)
  }, [demoStageRef, step])

  const isCursorVisible =
    cursorPosition !== null &&
    step > HOME_DEMO_STEP.READY &&
    step < HOME_DEMO_STEP.REMOVED

  return (
    <div
      ref={demoStageRef}
      className="home-save-demo relative pointer-events-none t-stagger-line t-stagger-line--4 mt-12 mb-16 w-full max-w-4xl select-none pt-16 md:mb-24"
      data-demo-item-created={step === HOME_DEMO_STEP.ITEM_CREATED}
      data-step={step}
      aria-label="Animated preview of saving and removing a video link in Lynvo"
    >
      <div
        aria-hidden={!isCopySourceVisible}
        className={`home-demo-copy-source absolute top-0 left-1/2 z-30 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-2 px-1 py-1 text-center transition-transform duration-200 ${isCopySourceVisible ? "visible translate-y-0" : "invisible -translate-y-1"}`}
      >
        <span className="block max-w-52 truncate text-xs text-foreground">
          {HOME_DEMO_CLIPBOARD_URL}
        </span>
        <button
          ref={copySourceRef}
          aria-label="Copy source link"
          className={`pointer-events-auto flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-[background-color,color,transform] duration-150 ${isCopySourcePressed ? "scale-[0.96] bg-blue-500 text-white" : "bg-muted/80"}`}
          onClick={handleCopySourceClick}
          tabIndex={isCopySourceVisible ? 0 : -1}
          type="button"
        >
          <HugeiconsIcon icon={CopyIcon} className="size-4" />
        </button>
      </div>

      <div
        data-demo-browser="true"
        className="relative overflow-hidden rounded-[18px] bg-background/95 shadow-[0_2px_3px_rgba(0,0,0,0.05),0_16px_40px_-12px_rgba(0,0,0,0.18),0_36px_80px_-24px_rgba(0,0,0,0.2)] ring-1 ring-black/10 backdrop-blur-xl dark:bg-background/90 dark:shadow-[0_2px_3px_rgba(0,0,0,0.4),0_24px_70px_-20px_rgba(0,0,0,0.9)] dark:ring-white/10"
      >
        <div
          data-demo-browser-toolbar="true"
          className="flex h-12 items-center gap-3 bg-muted/65 px-4 shadow-[inset_0_-1px_rgba(0,0,0,0.08)] dark:bg-muted/35 dark:shadow-[inset_0_-1px_rgba(255,255,255,0.08)]"
        >
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

        <div
          data-demo-browser-content="true"
          className="relative px-4 py-7 sm:px-8 sm:py-10"
        >
          <div className="mx-auto mb-8 flex w-full flex-col gap-4">
            <div className="home-demo-clipboard-slot min-h-10">
              <div
                aria-hidden={!isClipboardOpen}
                className={`home-demo-clipboard-reveal grid transition-[grid-template-rows,opacity] duration-200 motion-reduce:transition-none ${isClipboardOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
              >
                <div className="min-h-0 overflow-hidden">
                  <button
                    ref={clipboardRef}
                    aria-hidden={!isClipboardOpen}
                    aria-label={`Paste clipboard link ${HOME_DEMO_CLIPBOARD_URL}`}
                    className="pointer-events-auto w-full cursor-pointer rounded-md px-1 py-2 text-left"
                    onClick={handleClipboardClick}
                    type="button"
                    tabIndex={isClipboardOpen ? 0 : -1}
                  >
                    <span
                      className={`${isClipboardOpen ? "shimmer shimmer-color-blue-500/60 shimmer-duration-6000 shimmer-spread-24" : ""} block max-w-full truncate text-base font-normal text-primary`}
                    >
                      {HOME_DEMO_CLIPBOARD_URL}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <InputGroup className="h-13.5 w-full rounded-full border-2 border-default-medium bg-muted/30 sm:flex-1">
              <InputGroupInput
                aria-label="Link"
                className="pl-5 text-base text-heading md:text-base"
                placeholder="https://example.com/video"
                readOnly
                tabIndex={-1}
                value={isLinkPasted ? HOME_DEMO_CLIPBOARD_URL : ""}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  aria-label="Save link"
                  className="size-11 rounded-full"
                  disabled={!isLinkPasted}
                  size="icon-xs"
                  title="Save link"
                  type="button"
                  variant="default"
                >
                  {isSaving ? (
                    <Spinner
                      className="size-6"
                      aria-label="Saving demo link…"
                    />
                  ) : (
                    <HugeiconsIcon
                      icon={ArrowRight02Icon}
                      strokeWidth={2}
                      className="size-6"
                    />
                  )}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </div>

          <section className="relative border-t">
            {visibleHomeDemoItems.map((item, itemIndex) => (
              <DemoLibraryItem
                key={`home-demo-library-slot-${itemIndex}`}
                item={item}
                menuTriggerRef={item.isNew ? menuTriggerRef : undefined}
                isMenuTriggerPressed={item.isNew && isMenuTriggerPressed}
              />
            ))}
            {isMenuOpen && (
              <DemoLinkMenu
                removeMenuItemRef={removeMenuItemRef}
                isRemoveMenuItemFocused={isRemoveMenuItemFocused}
              />
            )}
          </section>

          {isRemoveDialogOpen && (
            <DemoRemoveDialog
              confirmButtonRef={confirmButtonRef}
              isConfirmButtonPressed={isConfirmButtonPressed}
            />
          )}
        </div>
      </div>

      <svg
        className="home-demo-cursor pointer-events-none absolute z-[60] h-7 w-7 drop-shadow-[0_2px_2px_rgba(0,0,0,0.25)]"
        data-visible={isCursorVisible}
        data-pressed={isCursorPressed}
        style={{
          transform: `translate3d(${cursorPosition?.left ?? 0}px, ${cursorPosition?.top ?? 0}px, 0)`,
        }}
        viewBox="0 0 28 28"
        aria-hidden="true"
      >
        <path
          className="home-demo-cursor__shape"
          d="M5 3.5 22.1 17l-8.4 1.2-4.6 7.1L5 3.5Z"
          fill="white"
          stroke="black"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  )
}

const DemoLibraryItem = ({
  item,
  menuTriggerRef,
  isMenuTriggerPressed = false,
}: DemoLibraryItemProps) => (
  <div className="home-demo-library-item border-b last:border-b-0">
    <div
      className={`flex min-h-24 w-full items-center gap-0 px-4 py-6 md:gap-3 ${item.isOpened ? "bg-sky-500/15" : ""}`}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2 text-left md:gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center text-foreground md:size-14">
          <HugeiconsIcon icon={item.icon} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block line-clamp-3 break-words text-sm font-normal md:text-lg">
            {item.title}
          </span>
          <span
            className={`mt-1 block truncate text-xs ${item.isOpened ? "text-foreground/80" : "text-muted-foreground"}`}
          >
            {item.detail}
          </span>
        </span>
      </span>
      {item.isNew && <NewBadge />}
      {item.meta && (
        <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
          {item.meta}
        </span>
      )}
      <Button
        ref={menuTriggerRef}
        aria-label={`Open menu for ${item.title}`}
        className={`size-8 shrink-0 text-foreground hover:bg-transparent hover:text-foreground ${isMenuTriggerPressed ? "scale-[0.96]" : ""}`}
        size="icon"
        type="button"
        variant="ghost"
      >
        <HugeiconsIcon icon={EllipsisIcon} />
      </Button>
      {item.isFolder && (
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          className="shrink-0 text-foreground"
        />
      )}
    </div>
  </div>
)

const DemoMenuItem = ({
  icon,
  label,
  itemRef,
  isDestructive = false,
  isHighlighted = false,
  showArrow = false,
}: DemoMenuItemProps) => (
  <div
    ref={itemRef}
    className={`group/dropdown-menu-item relative flex cursor-default items-center gap-2.5 rounded-xl px-3 py-2 text-sm outline-hidden select-none ${getDemoMenuItemTextClassName(isDestructive)} ${getDemoMenuItemHighlightClassName(isDestructive, isHighlighted)}`}
  >
    <HugeiconsIcon icon={icon} className="size-4 shrink-0" />
    <span>{label}</span>
    {showArrow && (
      <HugeiconsIcon
        icon={ArrowRight01Icon}
        strokeWidth={2}
        className="ml-auto size-4"
      />
    )}
  </div>
)

const DemoLinkMenu = ({
  removeMenuItemRef,
  isRemoveMenuItemFocused,
}: DemoLinkMenuProps) => (
  <div
    className="home-demo-menu absolute top-16 right-3 z-30 max-h-(--available-height) w-48 min-w-48 origin-top-right overflow-x-hidden overflow-y-auto rounded-2xl bg-popover p-1 text-popover-foreground shadow-2xl ring-1 ring-foreground/5 outline-none dark:ring-foreground/10"
    aria-hidden="true"
  >
    <div>
      <DemoMenuItem icon={CopyIcon} label="Copy Source link" />
      <DemoMenuItem icon={ArrowUpRight01Icon} label="Open in" showArrow />
    </div>
    <div className="my-1 border-t" />
    <DemoMenuItem
      itemRef={removeMenuItemRef}
      icon={Delete02Icon}
      label="Remove saved link"
      isDestructive
      isHighlighted={isRemoveMenuItemFocused}
    />
  </div>
)

const DemoRemoveDialog = ({
  confirmButtonRef,
  isConfirmButtonPressed,
}: DemoRemoveDialogProps) => (
  <dialog
    open
    className="home-demo-remove-dialog absolute inset-0 z-50 m-0 flex h-full w-full max-w-none items-center justify-center border-0 bg-black/80 p-4 supports-backdrop-filter:backdrop-blur-xs sm:p-8"
    aria-label="Remove this link?"
  >
    <div className="home-demo-remove-dialog__surface grid w-full max-w-[calc(100%-2rem)] gap-6 rounded-4xl bg-popover p-10 text-popover-foreground shadow-2xl ring-1 ring-foreground/5 sm:max-w-md">
      <div className="grid w-full place-items-center gap-4 text-center">
        <h2 className="w-full px-0 text-center text-2xl font-normal leading-tight sm:px-10 sm:text-3xl">
          Remove this link?
        </h2>
        <p className="w-full text-center text-base text-muted-foreground">
          This removes the link from your list. You can save it again from the
          source link.
        </p>
      </div>
      <div className="mt-4 flex w-full flex-col gap-3">
        <Button
          ref={confirmButtonRef}
          className={`h-13.5 w-full ${isConfirmButtonPressed ? "scale-[0.96]" : ""}`}
          size="lg"
          type="button"
          variant="destructive"
        >
          Remove
        </Button>
        <Button
          className="h-13.5 w-full border-muted-foreground/20"
          size="lg"
          type="button"
          variant="outline"
        >
          Cancel
        </Button>
      </div>
    </div>
  </dialog>
)
