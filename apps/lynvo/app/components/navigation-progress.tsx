import { useNavigation } from "react-router"

export const NavigationProgress = () => {
  const navigation = useNavigation()

  if (navigation.state !== "loading") {
    return null
  }

  return (
    <div
      aria-label="Loading page"
      className="navigation-progress"
      role="progressbar"
    />
  )
}
