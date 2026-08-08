import { Link } from "react-router"

import { PolicyLayout, PolicySection } from "~/components/PolicyLayout"
import { SupportChannelLinks } from "~/components/SupportChannelLinks"
import { policyPaths } from "~/lib/paths"

const CLOUDFLARE_TURNSTILE_PRIVACY_URL =
  "https://www.cloudflare.com/turnstile-privacy-policy/"

const cookieRows = [
  {
    source: "Lynvo",
    name: "csrf-token",
    duration: "1 day",
    purpose: "Request security and forgery prevention",
    domain: "Lynvo host",
  },
  {
    source: "Lynvo",
    name: "__Host-lynvo-session",
    duration: "Up to 30 days; 7-day idle timeout",
    purpose: "Authentication and session continuity",
    domain: "Lynvo host",
  },
  {
    source: "Lynvo",
    name: "lynvo-theme",
    duration: "1 year",
    purpose: "Remembering light or dark appearance",
    domain: "Lynvo host",
  },
] as const

const browserStorageRows = [
  {
    source: "Lynvo",
    name: "theme",
    duration: "Until cleared",
    purpose: "Remembering your appearance preference",
    domain: "Lynvo origin",
  },
  {
    source: "Lynvo",
    name: "lynvo:player:range-supported:v1",
    duration: "Until cleared",
    purpose: "Remembering the selected player for range-supported links",
    domain: "Lynvo origin",
  },
  {
    source: "Lynvo",
    name: "lynvo:player:range-unsupported:v1",
    duration: "Until cleared",
    purpose: "Remembering the selected player for other links",
    domain: "Lynvo origin",
  },
  {
    source: "Lynvo",
    name: "lynvo:drafts:v1",
    duration: "Up to 7 days per draft",
    purpose: "Temporarily retaining link drafts before they are saved",
    domain: "Lynvo origin",
  },
  {
    source: "Lynvo",
    name: "lynvo:links:sync:v1:<account-id>",
    duration: "Until cleared",
    purpose: "Caching synchronized saved-link records for the account",
    domain: "Lynvo origin",
  },
  {
    source: "Lynvo",
    name: "lynvo_remote_session_id",
    duration: "Until cleared",
    purpose: "Remembering a paired Remote Play session",
    domain: "Lynvo origin",
  },
  {
    source: "Lynvo",
    name: "lynvo_remote_device_name",
    duration: "Until cleared",
    purpose: "Remembering the paired Remote Play device name",
    domain: "Lynvo origin",
  },
] as const

export const CookiePolicyContent = () => (
  <PolicyLayout title="Cookie policy" updatedAt="August 8, 2026">
    <p className="max-w-3xl text-left text-base leading-7 text-foreground">
      This Cookie Policy explains what cookies and similar technologies Lynvo
      uses, why Lynvo uses them, and how you can manage them. Read it with the{" "}
      <Link
        to={policyPaths.privacyPolicy}
        className="underline underline-offset-4"
      >
        Privacy policy
      </Link>
      , which explains how Lynvo processes personal data more broadly.
    </p>

    <PolicySection title="What cookies and similar technologies are">
      <p>
        Cookies are small text files placed on your device when you use an
        online service. They can remember details such as whether you are signed
        in, protect requests from misuse, or retain an appearance preference.
      </p>
      <p>
        In this policy, “cookies” also means similar browser technologies,
        including local storage and identifiers used by service providers.
        First-party cookies are set by Lynvo. A service provider may set
        third-party cookies or identifiers to help deliver or secure Lynvo.
      </p>
    </PolicySection>

    <PolicySection title="Necessary cookies used by Lynvo">
      <p>
        Necessary cookies are required to operate Lynvo. They support login,
        session continuity, request security, fraud and abuse prevention, and
        user-selected functionality. Lynvo does not provide a separate
        preference control for these cookies because disabling them would stop
        parts of Lynvo from working.
      </p>

      <div className="my-6 overflow-x-auto">
        <table className="w-full min-w-2xl border-collapse border border-foreground/20 text-left text-sm [&_td+td]:border-l [&_td+td]:border-foreground/20 [&_th+th]:border-l [&_th+th]:border-foreground/20">
          <thead>
            <tr>
              <th className="px-4 py-3 font-semibold">Source</th>
              <th className="px-4 py-3 font-semibold">Cookie name</th>
              <th className="px-4 py-3 font-semibold">Duration</th>
              <th className="px-4 py-3 font-semibold">Purpose</th>
              <th className="px-4 py-3 font-semibold">Domain</th>
            </tr>
          </thead>
          <tbody>
            {cookieRows.map((cookie) => (
              <tr
                key={cookie.name}
                className="border-t border-foreground/20 align-top"
              >
                <td className="px-4 py-3">{cookie.source}</td>
                <td className="px-4 py-3 font-mono text-xs">{cookie.name}</td>
                <td className="px-4 py-3">{cookie.duration}</td>
                <td className="px-4 py-3">{cookie.purpose}</td>
                <td className="px-4 py-3">{cookie.domain}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p>
        Cloudflare may also use cookies or device signals when providing site
        delivery, bot detection, rate limiting, and Turnstile verification.
        According to Cloudflare&apos;s{" "}
        <a
          href={CLOUDFLARE_TURNSTILE_PRIVACY_URL}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4"
        >
          Turnstile Privacy Addendum
        </a>
        , Turnstile processes necessary signals such as the client IP address,
        TLS fingerprint, user-agent header, sitekey, and associated origin to
        distinguish people from bots and improve bot detection. Cloudflare
        controls the exact cookie names and durations, which can vary with the
        security check, browser, and region.
      </p>
    </PolicySection>

    <PolicySection title="Similar browser storage used by Lynvo">
      <p>
        Lynvo uses local browser storage for settings that do not need to be
        sent with every web request. The table lists the current items:
      </p>

      <div className="my-6 overflow-x-auto">
        <table className="w-full min-w-xl border-collapse border border-foreground/20 text-left text-sm [&_td+td]:border-l [&_td+td]:border-foreground/20 [&_th+th]:border-l [&_th+th]:border-foreground/20">
          <thead>
            <tr>
              <th className="px-4 py-3 font-semibold">Source</th>
              <th className="px-4 py-3 font-semibold">Storage item</th>
              <th className="px-4 py-3 font-semibold">Duration</th>
              <th className="px-4 py-3 font-semibold">Purpose</th>
              <th className="px-4 py-3 font-semibold">Domain</th>
            </tr>
          </thead>
          <tbody>
            {browserStorageRows.map((storageItem) => (
              <tr
                key={storageItem.name}
                className="border-t border-foreground/20 align-top"
              >
                <td className="px-4 py-3">{storageItem.source}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {storageItem.name}
                </td>
                <td className="px-4 py-3">{storageItem.duration}</td>
                <td className="px-4 py-3">{storageItem.purpose}</td>
                <td className="px-4 py-3">{storageItem.domain}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PolicySection>

    <PolicySection title="Analytics and marketing cookies">
      <p>
        Lynvo does not use optional analytics or marketing cookies, including
        advertising cookies, in the current service. If Lynvo adds them, this
        policy will identify their source, name, duration, purpose, domain, and
        available choices.
      </p>
    </PolicySection>

    <PolicySection title="Managing cookies and browser storage">
      <p>
        Lynvo currently uses only the cookies and browser storage required for
        authentication, security, appearance, player defaults, drafts,
        saved-link caching, and connected devices.
      </p>
      <p>
        Your browser settings can block or delete cookies and local storage.
        Blocking necessary storage may prevent login, security checks,
        appearance settings, or other features from working correctly.
      </p>
      <p>
        Cookie and browser-storage choices apply to the browser and device where
        you make them. You may need to repeat the choice on another browser or
        device.
      </p>
    </PolicySection>

    <PolicySection title="Changes to this policy">
      <p>
        Lynvo may update this policy when its storage practices, providers, or
        legal obligations change. The updated date at the top shows when the
        policy was most recently revised. Lynvo will present material changes as
        required by applicable law.
      </p>
    </PolicySection>

    <PolicySection title="Additional information and questions">
      <p>
        For questions about this cookie policy or Lynvo&apos;s use of browser
        storage, use <SupportChannelLinks />.
      </p>
    </PolicySection>
  </PolicyLayout>
)
