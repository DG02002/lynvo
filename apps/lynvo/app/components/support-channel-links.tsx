import { GITHUB_ISSUES_URL, TELEGRAM_SUPPORT_URL } from "~/lib/support-links"

const supportLinkClassName = "underline underline-offset-4"

export const TelegramSupportLink = () => (
  <a
    href={TELEGRAM_SUPPORT_URL}
    target="_blank"
    rel="noreferrer"
    className={supportLinkClassName}
  >
    Telegram
  </a>
)

const GitHubIssuesLink = () => (
  <a
    href={GITHUB_ISSUES_URL}
    target="_blank"
    rel="noreferrer"
    className={supportLinkClassName}
  >
    GitHub Issues
  </a>
)

export const SupportChannelLinks = () => (
  <>
    <TelegramSupportLink /> or <GitHubIssuesLink />
  </>
)
