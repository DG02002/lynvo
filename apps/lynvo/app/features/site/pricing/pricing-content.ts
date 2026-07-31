export const pricingFaqs = [
  {
    value: "storage-cap",
    question: "What counts toward the Free plan’s 3 MB storage limit?",
    answer:
      "Saved links, folders, and playback details count toward the 3 MB limit. Linked video files are not stored by Lynvo and do not count toward it. Each saved-link record can use up to 1 MB, and the plan allows up to 100 saved links.",
  },
  {
    value: "official-operation",
    question: "What counts as a Lynvo Plugin Server request?",
    answer:
      "Lynvo counts one use when the Lynvo Plugin Server accepts a request to open a supported link. The 200-request monthly allowance and 15-request daily limit are shared across Lynvo Plugins and direct media. Browsing Lynvo, opening Settings, and using a Custom Plugin Server do not use this allowance.",
  },
  {
    value: "limit-reached",
    question: "What happens after a Lynvo Plugin Server limit is reached?",
    answer:
      "New Lynvo Plugin Server requests remain unavailable until the applicable daily or monthly limit resets. Saved links, Settings, and Custom Plugin Servers remain available.",
  },
  {
    value: "operating-systems",
    question: "Which operating systems does Lynvo support?",
    answer:
      "Lynvo is designed for Android. Player handoff depends on supported Android video players, so other operating systems are not currently supported.",
  },
  {
    value: "links",
    question: "Which links can Lynvo save?",
    answer:
      "Lynvo can save direct media links, links supported by an official Plugin, and links handled by a configured Custom Plugin Server.",
  },
  {
    value: "privacy",
    question: "How does Lynvo protect account privacy?",
    answer:
      "Lynvo stores account records and link metadata, not the linked video files. Account controls can remove history, change the retention period, revoke sessions, and delete the account.",
  },
]
