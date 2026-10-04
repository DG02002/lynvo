export const SAVE_LIST_FEEDBACK_RING_CLASSES = {
  gallery: {
    highlighted:
      "group-data-[highlighted]:ring-2 group-data-[highlighted]:ring-primary",
    failed:
      "group-data-[extraction-state=failed]:ring-2 group-data-[extraction-state=failed]:ring-destructive",
  },
  row: {
    highlighted:
      "data-[highlighted]:ring-1 data-[highlighted]:ring-inset data-[highlighted]:ring-primary",
    failed:
      "data-[extraction-state=failed]:ring-1 data-[extraction-state=failed]:ring-inset data-[extraction-state=failed]:ring-destructive",
  },
} as const
