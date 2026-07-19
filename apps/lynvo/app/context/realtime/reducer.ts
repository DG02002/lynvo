export type RealtimeStatus =
  | "disabled"
  | "connecting"
  | "connected"
  | "disconnected"

export interface RealtimeState {
  status: RealtimeStatus
}

export type RealtimeAction = { type: "SET_STATUS"; status: RealtimeStatus }

export const realtimeReducer = (
  state: RealtimeState,
  action: RealtimeAction
): RealtimeState => {
  if (state.status === action.status) {
    return state
  }

  return { ...state, status: action.status }
}
