const OUTLINE_VISIBILITY_PADDING_PX = 8

export const getScrollAdjustment = ({
  containerBottom,
  containerTop,
  itemBottom,
  itemTop,
}: {
  containerBottom: number
  containerTop: number
  itemBottom: number
  itemTop: number
}) => {
  if (itemTop < containerTop + OUTLINE_VISIBILITY_PADDING_PX) {
    return itemTop - containerTop - OUTLINE_VISIBILITY_PADDING_PX
  }
  if (itemBottom > containerBottom - OUTLINE_VISIBILITY_PADDING_PX) {
    return itemBottom - containerBottom + OUTLINE_VISIBILITY_PADDING_PX
  }
  return 0
}
