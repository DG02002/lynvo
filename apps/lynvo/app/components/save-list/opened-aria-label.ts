interface ItemAriaLabelOptions {
  readonly label: string | undefined
  readonly isOpened: boolean
  readonly isNew?: boolean
}

export const buildItemAriaLabel = ({
  label,
  isOpened,
  isNew = false,
}: ItemAriaLabelOptions) =>
  label
    ? [label, isNew ? "new" : undefined, isOpened ? "opened" : undefined]
        .filter(Boolean)
        .join(", ")
    : undefined
