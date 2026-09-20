export const getOpenedAriaLabel = (
  label: string | undefined,
  isOpened: boolean,
  isNew = false
) =>
  label
    ? [label, isNew ? "new" : undefined, isOpened ? "opened" : undefined]
        .filter(Boolean)
        .join(", ")
    : undefined
