import { useEffect, useRef } from "react"
import { PLAYER_DEFINITIONS } from "~/lib/player-utils"

const PLAYER_PREVIEWS: Partial<Record<string, string>> = {
  just: "/images/player-previews/just-player.webp",
  vlc: "/images/player-previews/vlc-player.webp",
  mpv: "/images/player-previews/mpv-player.webp",
  mx: "/images/player-previews/mx-player.webp",
}

type Slot = {
  depth: number
  x: number
  y: number
  z: number
  zIndex: number
}

type CardLayout = {
  cardDistance: number
  verticalDistance: number
  skew: number
  dropDistance: number
}

const DEFAULT_LAYOUT: CardLayout = {
  cardDistance: 54,
  verticalDistance: 68,
  skew: 5,
  dropDistance: 500,
}

const getLayout = (viewportWidth: number): CardLayout => {
  if (viewportWidth <= 640) {
    return {
      cardDistance: 18,
      verticalDistance: 34,
      skew: 2.5,
      dropDistance: 340,
    }
  }

  if (viewportWidth <= 1024) {
    return {
      cardDistance: 36,
      verticalDistance: 50,
      skew: 4,
      dropDistance: 420,
    }
  }

  return DEFAULT_LAYOUT
}

const SWAP_DELAY = 4400

const makeSlot = (index: number, layout: CardLayout): Slot => ({
  depth: index,
  x: index * layout.cardDistance,
  y: index * -layout.verticalDistance,
  z: index * layout.cardDistance * -1.5,
  zIndex: PLAYER_DEFINITIONS.length - index,
})

const transformForSlot = (slot: Slot, layout: CardLayout) =>
  `translate(-50%, -50%) translate3d(${slot.x}px, ${slot.y}px, ${slot.z}px) skewY(${layout.skew}deg)`

const transformForDrop = (slot: Slot, layout: CardLayout) =>
  `translate(-50%, -50%) translate3d(${slot.x}px, ${slot.y + layout.dropDistance}px, ${slot.z}px) skewY(${layout.skew}deg)`

const DEPTH_OPACITY = [1, 0.9, 0.78, 0.66]

const opacityForSlot = (slot: Slot) =>
  DEPTH_OPACITY[slot.depth] ?? DEPTH_OPACITY.at(-1)!

export const PlayerCardSwap = () => {
  const cardRefs = useRef<Array<HTMLElement | null>>([])
  const orderRef = useRef(PLAYER_DEFINITIONS.map((_, index) => index))
  const timerRef = useRef<number | undefined>(undefined)
  const runningRef = useRef(false)
  const pausedRef = useRef(false)
  const reducedMotionRef = useRef(false)
  const animationsRef = useRef<Animation[]>([])
  const scheduleRef = useRef<(delay?: number) => void>(() => {})
  const layoutRef = useRef(DEFAULT_LAYOUT)
  const zIndexTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    let disposed = false
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    reducedMotionRef.current = mediaQuery.matches
    layoutRef.current = getLayout(window.innerWidth)

    const placeCards = () => {
      orderRef.current.forEach((cardIndex, slotIndex) => {
        const card = cardRefs.current[cardIndex]
        if (!card) {
          return
        }

        const slot = makeSlot(slotIndex, layoutRef.current)
        card.style.transform = transformForSlot(slot, layoutRef.current)
        card.style.opacity = String(opacityForSlot(slot))
        card.style.zIndex = String(slot.zIndex)
      })
    }

    const scheduleSwap = (delay = SWAP_DELAY) => {
      window.clearTimeout(timerRef.current)
      if (pausedRef.current || reducedMotionRef.current) {
        return
      }
      timerRef.current = window.setTimeout(swap, delay)
    }
    scheduleRef.current = scheduleSwap

    const swap = async () => {
      if (runningRef.current || pausedRef.current || reducedMotionRef.current) {
        scheduleSwap()
        return
      }

      runningRef.current = true
      const layout = layoutRef.current
      const [frontIndex, ...remaining] = orderRef.current
      const frontCard = cardRefs.current[frontIndex]

      if (!frontCard) {
        runningRef.current = false
        return
      }

      const frontSlot = makeSlot(0, layout)
      const backSlot = makeSlot(PLAYER_DEFINITIONS.length - 1, layout)
      const frontAnimation = frontCard.animate(
        [
          {
            transform: transformForSlot(frontSlot, layout),
            opacity: opacityForSlot(frontSlot),
            offset: 0,
          },
          {
            transform: transformForDrop(frontSlot, layout),
            opacity: opacityForSlot(frontSlot),
            offset: 0.3,
            easing: "cubic-bezier(0.4, 0, 0.6, 1)",
          },
          {
            transform: transformForSlot(backSlot, layout),
            opacity: opacityForSlot(backSlot),
            offset: 1,
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",
          },
        ],
        { duration: 1900, fill: "forwards" }
      )

      const promotions = remaining.map((cardIndex, index) => {
        const card = cardRefs.current[cardIndex]
        if (!card) {
          return undefined
        }

        const fromSlot = makeSlot(index + 1, layout)
        const toSlot = makeSlot(index, layout)
        card.style.zIndex = String(toSlot.zIndex)
        return card.animate(
          [
            {
              transform: transformForSlot(fromSlot, layout),
              opacity: opacityForSlot(fromSlot),
            },
            {
              transform: transformForSlot(toSlot, layout),
              opacity: opacityForSlot(toSlot),
            },
          ],
          {
            delay: 160 + index * 100,
            duration: 1420,
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",
            fill: "forwards",
          }
        )
      })

      animationsRef.current = [frontAnimation, ...promotions].filter(
        (animation): animation is Animation => Boolean(animation)
      )

      zIndexTimerRef.current = window.setTimeout(() => {
        frontCard.style.zIndex = String(backSlot.zIndex)
      }, 570)

      await Promise.allSettled(
        animationsRef.current.map((animation) => animation.finished)
      )

      if (disposed) {
        return
      }

      orderRef.current = [...remaining, frontIndex]
      animationsRef.current.forEach((animation) => animation.cancel())
      animationsRef.current = []
      placeCards()
      runningRef.current = false
      scheduleSwap()
    }

    const updateMotionPreference = () => {
      reducedMotionRef.current = mediaQuery.matches
      if (mediaQuery.matches) {
        window.clearTimeout(timerRef.current)
      } else {
        scheduleSwap()
      }
    }

    const updateLayout = () => {
      layoutRef.current = getLayout(window.innerWidth)
      if (!runningRef.current) {
        placeCards()
      }
    }

    placeCards()
    scheduleSwap()
    mediaQuery.addEventListener("change", updateMotionPreference)
    window.addEventListener("resize", updateLayout)

    return () => {
      disposed = true
      window.clearTimeout(timerRef.current)
      window.clearTimeout(zIndexTimerRef.current)
      animationsRef.current.forEach((animation) => animation.cancel())
      mediaQuery.removeEventListener("change", updateMotionPreference)
      window.removeEventListener("resize", updateLayout)
    }
  }, [])

  const pause = () => {
    pausedRef.current = true
    window.clearTimeout(timerRef.current)
  }

  const resume = () => {
    pausedRef.current = false
    scheduleRef.current()
  }

  return (
    <div
      className="player-card-swap"
      aria-label="Supported Android player previews"
      role="list"
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocus={pause}
      onBlur={resume}
    >
      {PLAYER_DEFINITIONS.map((player, index) => {
        const preview = PLAYER_PREVIEWS[player.id]

        return (
          <article
            key={player.id}
            ref={(element) => {
              cardRefs.current[index] = element
            }}
            role="listitem"
            className="player-card-swap__card"
            style={{
              transform: transformForSlot(
                makeSlot(index, DEFAULT_LAYOUT),
                DEFAULT_LAYOUT
              ),
              opacity: opacityForSlot(makeSlot(index, DEFAULT_LAYOUT)),
              zIndex: makeSlot(index, DEFAULT_LAYOUT).zIndex,
            }}
          >
            <div className="player-card-swap__preview">
              {preview ? (
                <img
                  src={preview}
                  alt={`${player.name} interface preview`}
                  className="size-full bg-black object-contain"
                />
              ) : (
                <div className="player-card-swap__placeholder">
                  <img
                    src={player.iconUrl}
                    alt=""
                    className="size-20 rounded-[18px] object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_16px_32px_-16px_rgba(0,0,0,0.45)] dark:shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_16px_32px_-16px_rgba(0,0,0,0.7)]"
                  />
                  <span>Preview coming soon</span>
                </div>
              )}
            </div>

            <div className="player-card-swap__footer">
              <img
                src={player.iconUrl}
                alt=""
                className="size-8 object-contain"
              />
              <span className="text-sm font-medium text-white/90">
                {player.name}
              </span>
            </div>
          </article>
        )
      })}
    </div>
  )
}
