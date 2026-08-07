export const PLAYER_LAUNCH_ERROR_EVENT = "lynvo:player-launch-error"

export interface PlayerLaunchErrorDetail {
  playerName: string
  playerIconUrl: string
}

export const showPlayerLaunchError = (
  playerName: string,
  playerIconUrl: string
) => {
  window.dispatchEvent(
    new CustomEvent<PlayerLaunchErrorDetail>(PLAYER_LAUNCH_ERROR_EVENT, {
      detail: { playerName, playerIconUrl },
    })
  )
}
