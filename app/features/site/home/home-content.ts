export const privacyPoints = [
  "Nothing to install for the Lynvo interface",
  "Keep the library private in an account",
  "Open links in the Android player you already trust",
  "Remove history or set an automatic retention window",
]

export const faqs = [
  {
    value: "storage-cap",
    question: "Why does the free plan have a 3 MB storage limit?",
    answer:
      "The limit keeps the free service reliable and helps prevent abuse. It applies to Lynvo account records and metadata, not to the size of the video files linked from your account. A single saved-link record can use up to 1 MB.",
  },
  {
    value: "future-storage",
    question: "Will Lynvo increase the storage limit in the future?",
    answer:
      "There is no announced increase right now. Lynvo may change its limits as the service develops, and any change will be reflected in the interface or terms.",
  },
  {
    value: "inactivity",
    question: "What is Lynvo's account inactivity policy?",
    answer:
      "Lynvo permanently deletes an account and its associated data after 90 days (3 months) without recorded account activity. The check runs daily, and Lynvo does not collect an email address for advance inactivity warnings.",
  },
  {
    value: "retention",
    question: "How long are saved links kept?",
    answer:
      "Saved links use a 90-day retention period by default. You can choose 7, 30, 90, or 180 days in Settings, and Lynvo checks daily for records older than your selected period.",
  },
  {
    value: "operating-systems",
    question: "Does Lynvo work on operating systems other than Android?",
    answer:
      "Lynvo is made for Android OS. Its player handoff depends on supported Android video players, so other operating systems are not currently supported.",
  },
  {
    value: "links",
    question: "What kind of links can I save?",
    answer:
      "You can save direct media links, links supported by an official Lynvo plugin, or links handled by your configured external extractor.",
  },
  {
    value: "privacy",
    question: "How is this different from installing a streaming catalog app?",
    answer:
      "Lynvo is a web-based link library and launcher, not a catalog or addon ecosystem. You choose every link and player. That smaller footprint can be a better privacy fit than installing an app such as Stremio with multiple third-party addons.",
  },
]
