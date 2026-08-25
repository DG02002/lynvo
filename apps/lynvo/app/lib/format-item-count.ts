export const formatItemCount = (itemCount: number): string =>
  `${itemCount} ${itemCount === 1 ? "item" : "items"}`
