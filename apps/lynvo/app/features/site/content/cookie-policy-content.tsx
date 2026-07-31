import { Link } from "react-router"

import { PolicyLayout, PolicySection } from "~/components/PolicyLayout"
import { policyPaths } from "~/lib/paths"

const cookieRows = [
  {
    source: "Lynvo",
    name: "csrf-token",
    duration: "1 day",
    purpose: "Request security and forgery prevention",
  },
  {
    source: "Lynvo",
    name: "__convexAuthJWT_lynvo",
    duration: "Up to 1 year",
    purpose: "Authentication and session continuity",
  },
  {
    source: "Lynvo",
    name: "__convexAuthRefreshToken_lynvo",
    duration: "Up to 1 year",
    purpose: "Secure authentication renewal",
  },
  {
    source: "Lynvo",
    name: "auth-transaction",
    duration: "10 minutes",
    purpose: "Completing a login transaction securely",
  },
  {
    source: "Lynvo",
    name: "lynvo-theme",
    duration: "1 year",
    purpose: "Remembering light or dark appearance",
  },
] as const

const browserStorageRows = [
  {
    name: "lynvo:cookie-preferences",
    duration: "Until cleared or replaced",
    purpose: "Remembering your cookie choices on this browser",
  },
  {
    name: "theme",
    duration: "Until cleared",
    purpose: "Remembering your appearance preference",
  },
  {
    name: "Lynvo authentication storage",
    duration: "Up to 1 year",
    purpose: "Maintaining your signed-in session",
  },
  {
    name: "Player and device preferences",
    duration: "Until cleared",
    purpose: "Remembering player defaults and connected-device state",
  },
] as const

export const CookiePolicyContent = () => (
  <PolicyLayout title="Cookie policy" updatedAt="July 31, 2026">
    <p className="max-w-3xl text-left text-base leading-7 text-foreground">
      This cookie policy explains how Lynvo uses cookies and similar
      technologies and how you can manage them. It should be read with the{" "}
      <Link
        to={policyPaths.privacyPolicy}
        className="underline underline-offset-4"
      >
        privacy policy
      </Link>
      , which explains how Lynvo processes personal information more broadly.
    </p>

    <PolicySection title="What cookies are">
      <p>
        Cookies are small text files placed on your device when you use an
        online service. They can remember details such as whether you are signed
        in, protect requests from misuse, or retain an appearance preference.
      </p>
      <p>
        This policy also uses the word “cookies” for similar browser
        technologies, including local storage and identifiers used by service
        providers. First-party cookies are set by Lynvo. Third-party cookies or
        identifiers may be set by a service provider that helps deliver or
        secure Lynvo.
      </p>
    </PolicySection>

    <PolicySection title="Necessary cookies">
      <p>
        Necessary cookies are required to operate Lynvo. They support login,
        session continuity, request security, fraud and abuse prevention, and
        user-selected functionality. They cannot be disabled through Lynvo’s
        cookie preferences because parts of Lynvo would no longer work.
      </p>

      <div className="my-6 overflow-x-auto">
        <table className="w-full min-w-2xl border-collapse border border-foreground/20 text-left text-sm [&_td+td]:border-l [&_td+td]:border-foreground/20 [&_th+th]:border-l [&_th+th]:border-foreground/20">
          <thead>
            <tr>
              <th className="px-4 py-3 font-semibold">Source</th>
              <th className="px-4 py-3 font-semibold">Cookie name</th>
              <th className="px-4 py-3 font-semibold">Duration</th>
              <th className="px-4 py-3 font-semibold">Purpose</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p>
        Cloudflare may also use cookies or device signals when providing site
        delivery, bot detection, rate limiting, and Turnstile verification.
        Their exact names and duration can vary with the security check,
        browser, and region.
      </p>
    </PolicySection>

    <PolicySection title="Similar browser storage">
      <p>
        Lynvo uses local browser storage for settings that do not need to be
        sent with every web request. The table lists the main items.
      </p>

      <div className="my-6 overflow-x-auto">
        <table className="w-full min-w-xl border-collapse border border-foreground/20 text-left text-sm [&_td+td]:border-l [&_td+td]:border-foreground/20 [&_th+th]:border-l [&_th+th]:border-foreground/20">
          <thead>
            <tr>
              <th className="px-4 py-3 font-semibold">Storage item</th>
              <th className="px-4 py-3 font-semibold">Duration</th>
              <th className="px-4 py-3 font-semibold">Purpose</th>
            </tr>
          </thead>
          <tbody>
            {browserStorageRows.map((storageItem) => (
              <tr
                key={storageItem.name}
                className="border-t border-foreground/20 align-top"
              >
                <td className="px-4 py-3 font-mono text-xs">
                  {storageItem.name}
                </td>
                <td className="px-4 py-3">{storageItem.duration}</td>
                <td className="px-4 py-3">{storageItem.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PolicySection>

    <PolicySection title="Analytics cookies">
      <p>
        Analytics cookies can help a service understand traffic, performance,
        and how visitors interact with its features. Lynvo does not currently
        set optional analytics cookies. Selecting an analytics preference
        records your choice but does not by itself install an analytics tool.
      </p>
      <p>
        If Lynvo introduces analytics cookies, they will remain off unless your
        saved choice and applicable law permit their use. This policy will be
        updated with the provider, cookie name, duration, and purpose.
      </p>
    </PolicySection>

    <PolicySection title="Marketing cookies">
      <p>
        Marketing measurement cookies can measure campaign effectiveness.
        Personalized marketing cookies can be used to tailor or measure
        marketing on third-party platforms. Lynvo does not currently set either
        category of marketing cookie.
      </p>
      <p>
        Selecting a marketing preference records your choice but does not by
        itself install marketing technology. If Lynvo introduces these cookies,
        this policy will be updated with specific disclosures before they are
        used.
      </p>
    </PolicySection>

    <PolicySection title="Managing cookies">
      <p>
        You can select <strong>Accept all cookies</strong>, select{" "}
        <strong>Reject optional cookies</strong>, or choose individual
        categories in <strong>Cookie preferences</strong>. Select{" "}
        <strong>Manage cookies</strong> in the footer to change these choices at
        any time.
      </p>
      <p>
        Your choices are specific to the browser and device where you save them.
        You may need to choose again after clearing browser data, using another
        browser, or using another device. Your browser settings can also block
        or delete cookies and local storage. Blocking necessary storage may
        prevent login, security checks, appearance settings, or other features
        from working correctly.
      </p>
    </PolicySection>

    <PolicySection title="Changes to this policy">
      <p>
        Lynvo may update this policy when its storage practices, providers, or
        legal obligations change. The updated date at the top shows when the
        policy was most recently revised. Material changes will be presented as
        required by applicable law.
      </p>
    </PolicySection>

    <PolicySection title="Questions">
      <p>
        Use the official contact method displayed by Lynvo if you have a
        question about this cookie policy or Lynvo’s use of browser storage.
      </p>
    </PolicySection>
  </PolicyLayout>
)
