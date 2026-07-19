export const sourceStatusVariant = (
  status: string | undefined
): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "active") {
    return "default"
  }
  if (status === "down") {
    return "destructive"
  }
  if (status === "maintenance" || status === "degraded") {
    return "outline"
  }
  return "secondary"
}
