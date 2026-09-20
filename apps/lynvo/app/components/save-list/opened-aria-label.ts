export const getOpenedAriaLabel = (
  label: string | undefined,
  isOpened: boolean
) => (label ? `${label}${isOpened ? ", opened" : ""}` : undefined)
