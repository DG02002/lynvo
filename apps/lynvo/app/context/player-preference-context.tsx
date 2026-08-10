import { createContext, useContext, type ReactNode } from "react"

const PlayerPreferenceIdentityContext = createContext<string | undefined>(
  undefined
)

export const PlayerPreferenceProvider = ({
  userId,
  children,
}: {
  userId?: string
  children: ReactNode
}) => (
  <PlayerPreferenceIdentityContext value={userId}>
    {children}
  </PlayerPreferenceIdentityContext>
)

export const usePlayerPreferenceIdentity = () =>
  useContext(PlayerPreferenceIdentityContext)
