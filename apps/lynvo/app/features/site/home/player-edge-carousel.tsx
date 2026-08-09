import { useEffect, useRef, useState } from "react"
import { PLAYER_DEFINITIONS } from "~/lib/player-utils"
import { useAnimationActivity } from "./use-animation-activity"

const PLAYER_PREVIEWS: Partial<Record<string, string>> = {
  just: "/images/player-previews/just-player.webp",
  vlc: "/images/player-previews/vlc-player.webp",
  mpv: "/images/player-previews/mpv-player.webp",
  mx: "/images/player-previews/mx-player.webp",
}

const STORAGE_KEY = "lynvo-player-carousel-track-start"
const LOOP_DURATION = 36_000

export const PlayerEdgeCarousel = () => {
  const { animationContainerRef, isAnimationActive } =
    useAnimationActivity<HTMLDivElement>()
  const [animationDelay, setAnimationDelay] = useState<number | null>(null)
  const motionRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    animation: Animation
    pointerX: number
    timelineTime: number
    loopDistance: number
  } | null>(null)

  useEffect(() => {
    let trackStartedAt = Date.now()

    try {
      const persisted = Number(window.localStorage.getItem(STORAGE_KEY))
      if (Number.isFinite(persisted) && persisted > 0) {
        trackStartedAt = persisted
      } else {
        trackStartedAt -= Math.random() * LOOP_DURATION
        window.localStorage.setItem(STORAGE_KEY, String(trackStartedAt))
      }
    } catch {
      // The carousel can still run if storage is blocked.
    }

    const elapsed = (Date.now() - trackStartedAt) % LOOP_DURATION
    setAnimationDelay(-elapsed)
  }, [])

  const finishDrag = (pointerId: number) => {
    const drag = dragRef.current
    if (!drag) {
      return
    }

    const timelineTime = Number(drag.animation.currentTime ?? 0)
    drag.animation.play()
    dragRef.current = null
    motionRef.current?.releasePointerCapture(pointerId)

    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        String(Date.now() - (timelineTime % LOOP_DURATION))
      )
    } catch {
      // Continue from the dragged position when storage is unavailable.
    }
  }

  return (
    <div
      ref={animationContainerRef}
      className="player-edge-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Android player previews"
    >
      <div
        ref={motionRef}
        className="player-edge-carousel__motion"
        data-ready={animationDelay !== null || undefined}
        data-animation-active={isAnimationActive || undefined}
        style={
          animationDelay === null
            ? undefined
            : { animationDelay: `${animationDelay}ms` }
        }
        onPointerDown={(event) => {
          if (event.button !== 0) {
            return
          }

          const animation = event.currentTarget.getAnimations()[0]
          const items = event.currentTarget.querySelectorAll<HTMLElement>(
            ".player-edge-carousel__item"
          )
          const loopDistance = items[PLAYER_DEFINITIONS.length]
            ? items[PLAYER_DEFINITIONS.length].offsetLeft - items[0].offsetLeft
            : 0

          if (!animation || loopDistance <= 0) {
            return
          }

          event.currentTarget.setPointerCapture(event.pointerId)
          animation.pause()
          dragRef.current = {
            animation,
            pointerX: event.clientX,
            timelineTime: Number(animation.currentTime ?? 0),
            loopDistance,
          }
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current
          if (!drag) {
            return
          }

          const deltaX = event.clientX - drag.pointerX
          const timeDelta = (deltaX / drag.loopDistance) * LOOP_DURATION
          drag.animation.currentTime = drag.timelineTime - timeDelta
        }}
        onPointerUp={(event) => finishDrag(event.pointerId)}
        onPointerCancel={(event) => finishDrag(event.pointerId)}
      >
        <ul className="player-edge-carousel__track">
          {[0, 1, 2].flatMap((setIndex) =>
            PLAYER_DEFINITIONS.map((player) => {
              const preview = PLAYER_PREVIEWS[player.id]

              return (
                <li
                  key={`${setIndex}-${player.id}`}
                  className="player-edge-carousel__item"
                  aria-hidden={setIndex !== 1 || undefined}
                >
                  <div className="player-edge-carousel__card">
                    <span className="player-edge-carousel__preview">
                      {preview ? (
                        <img
                          src={preview}
                          alt={`${player.name} interface preview`}
                          className="size-full bg-black object-contain"
                          draggable={false}
                        />
                      ) : (
                        <span className="player-edge-carousel__placeholder">
                          Preview coming soon
                        </span>
                      )}
                    </span>

                    <span className="player-edge-carousel__footer">
                      <img
                        src={player.iconUrl}
                        alt=""
                        className="size-7 object-contain"
                        draggable={false}
                      />
                      <span>{player.name}</span>
                    </span>
                  </div>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </div>
  )
}
