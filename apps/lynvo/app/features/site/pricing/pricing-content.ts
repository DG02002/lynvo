export const pricingFaqs = [
  {
    value: "storage-cap",
    question: "What counts toward the Free plan’s 3 MB storage limit?",
    answer:
      "Saved links, folders, and opened markers count toward the 3 MB limit. Linked video files are not stored by Lynvo and do not count toward it. Each saved-link record can use up to 256 KB, and the plan allows up to 1,000 saved links.",
  },
  {
    value: "lynvo-plugin-operation",
    question: "What counts as a Lynvo Plugin Server request?",
    answer:
      "Lynvo counts one use when the Lynvo Plugin Server accepts a request to open a supported link. The 200-request monthly allowance and 30-request daily limit are shared across all Lynvo Plugins, including Direct Media. Browsing Lynvo, opening Settings, and using a Custom Plugin Server do not use this allowance.",
  },
  {
    value: "limit-reached",
    question: "What happens after a Lynvo Plugin Server limit is reached?",
    answer:
      "New Lynvo Plugin Server requests remain unavailable until the applicable daily or monthly limit resets. Saved links, Settings, and Custom Plugin Servers remain available.",
  },
  {
    value: "operating-systems",
    question: "Where can Lynvo hand off links to players?",
    answer:
      "You can open the Lynvo website in any browser to sign in and manage links. Link handoff is designed for Android TV, Android phones, and Android tablets. Lynvo opens links in Just (Video) Player, VLC for Android, MPV, or MX Player.",
  },
  {
    value: "links",
    question: "Which links can Lynvo save?",
    answer:
      "Lynvo can save Direct Media links, links supported by a Lynvo Plugin, and links handled by a configured Custom Plugin Server.",
  },
  {
    value: "privacy",
    question: "How does Lynvo protect account privacy?",
    answer:
      "Lynvo stores account records and link metadata, not the linked video files. Account controls can remove saved links, change the retention period, revoke sessions, and delete the account.",
  },
]
