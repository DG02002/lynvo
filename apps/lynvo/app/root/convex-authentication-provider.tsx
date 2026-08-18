import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { ConvexProviderWithAuth, ConvexReactClient } from "convex/react"
import { createConvexAccessTokenFetcher } from "~/lib/convex-browser-auth"

interface ConvexAuthenticationConfiguration {
  readonly isAuthenticated: boolean
  readonly onSessionExpired: () => void
}

interface ConvexAuthenticationProviderProps {
  readonly isAuthenticated: boolean
  readonly onSessionExpired: () => void
  readonly children: ReactNode
}

const ConvexAuthenticationConfigurationContext =
  createContext<ConvexAuthenticationConfiguration | null>(null)

const useLynvoConvexAuth = () => {
  const configuration = useContext(ConvexAuthenticationConfigurationContext)
  if (!configuration) {
    throw new Error("Convex authentication configuration is missing")
  }
  const fetchAccessToken = useMemo(
    () =>
      createConvexAccessTokenFetcher({
        fetchRequest: fetch,
        onSessionExpired: configuration.onSessionExpired,
      }),
    [configuration.onSessionExpired]
  )
  return useMemo(
    () => ({
      isLoading: false,
      isAuthenticated: configuration.isAuthenticated,
      fetchAccessToken,
    }),
    [configuration.isAuthenticated, fetchAccessToken]
  )
}

export const ConvexAuthenticationProvider = ({
  isAuthenticated,
  onSessionExpired,
  children,
}: ConvexAuthenticationProviderProps) => {
  const [client] = useState(
    () => new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)
  )
  const handleSessionExpired = useCallback(
    () => onSessionExpired(),
    [onSessionExpired]
  )
  const configuration = useMemo(
    () => ({ isAuthenticated, onSessionExpired: handleSessionExpired }),
    [handleSessionExpired, isAuthenticated]
  )

  return (
    <ConvexAuthenticationConfigurationContext.Provider value={configuration}>
      <ConvexProviderWithAuth client={client} useAuth={useLynvoConvexAuth}>
        {children}
      </ConvexProviderWithAuth>
    </ConvexAuthenticationConfigurationContext.Provider>
  )
}
