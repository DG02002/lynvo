import { Link } from "react-router"
import { PolicyLayout, PolicySection } from "~/components/PolicyLayout"
import { TelegramSupportLink } from "~/components/SupportChannelLinks"
import { policyPaths } from "~/lib/paths"

const CLOUDFLARE_PRIVACY_URL = "https://www.cloudflare.com/policies/privacy/"
const CLOUDFLARE_TURNSTILE_PRIVACY_URL =
  "https://www.cloudflare.com/turnstile-privacy-policy/"
const CONVEX_DPA_URL = "https://www.convex.dev/legal/dpa"
const CONVEX_SUBPROCESSORS_URL = "https://www.convex.dev/legal/subprocessors"

const ProviderPolicyLink = ({
  href,
  children,
}: {
  href: string
  children: string
}) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="underline underline-offset-4"
  >
    {children}
  </a>
)

export const PrivacyPolicyContent = () => (
  <PolicyLayout title="Privacy policy" updatedAt="August 8, 2026">
    <p className="max-w-3xl text-left text-base leading-7 text-foreground">
      This Privacy Policy describes how Lynvo collects, uses, shares, and
      retains data when you create an account, save a link, connect a device, or
      configure a Plugin. It also explains the controls available to you.
    </p>
    <p>
      In this policy, <strong>Lynvo</strong> means the website and related
      service. An <strong>account</strong> is the username-based record used to
      access Lynvo. A <strong>saved link</strong> is a saved URL and its related
      metadata. A <strong>Plugin Server</strong> processes supported URLs. A{" "}
      <strong>Plugin</strong> is a Source-specific integration inside a Plugin
      Server, and a <strong>Source</strong> is the website, service, or URL
      pattern that the Plugin supports. <strong>Extraction</strong> is the
      process of resolving a supported URL into playable link information. A{" "}
      <strong>credential</strong> is a password, API key, or similar secret. A{" "}
      <strong>service provider</strong> is another organization that processes
      data or supplies infrastructure for Lynvo. <strong>Personal data</strong>
      means data that Lynvo links to you or your account.
    </p>

    <PolicySection title="1. Scope and privacy contact">
      <p>
        Lynvo operates the website and the link-saving, Extraction,
        synchronization, and Remote Play features described in this policy. For
        privacy questions, requests, or complaints, message us privately on{" "}
        <TelegramSupportLink />.
      </p>
      <p>
        This policy does not govern the privacy practices of Source websites,
        Plugin Servers, Custom Plugin Servers, players, or other third-party
        services that you choose to use with Lynvo. Those services have their
        own policies. The{" "}
        <Link
          to={policyPaths.cookiePolicy}
          className="underline underline-offset-4"
        >
          Cookie policy
        </Link>{" "}
        describes Lynvo&apos;s cookies and browser storage.
      </p>
    </PolicySection>

    <PolicySection title="2. Personal data Lynvo collects">
      <p>
        Lynvo collects data you provide, data created by your use of Lynvo, and
        data needed to protect and operate the service. This data includes:
      </p>
      <p>
        <strong className="text-foreground">
          Data you provide or configure:
        </strong>
      </p>
      <ul className="list-disc pl-6">
        <li>
          <strong className="text-foreground">Account data:</strong> your
          username, password hash, account creation date, and last-active date
        </li>
        <li>
          <strong className="text-foreground">Settings:</strong> player
          preferences, saved-link retention choice, Plugin Domains, and enabled
          Custom Plugin Servers
        </li>
        <li>
          <strong className="text-foreground">Credentials you add:</strong>
          Plugin Credentials and Plugin Server API keys
        </li>
      </ul>
      <p>
        <strong className="text-foreground">
          Data created by using Lynvo:
        </strong>
      </p>
      <ul className="list-disc pl-6">
        <li>
          <strong className="text-foreground">Saved-link data:</strong> URLs,
          titles, Source details, extracted file and folder metadata, opened
          markers, and record timestamps
        </li>
        <li>
          <strong className="text-foreground">Session data:</strong> session
          identifiers, device names, login and activity times, device pairing
          codes, and short-lived Remote Play commands
        </li>
      </ul>
      <p>
        <strong className="text-foreground">
          Security and diagnostic data:
        </strong>
      </p>
      <ul className="list-disc pl-6">
        <li>
          Request details, error information, rate-limit records, and Cloudflare
          Turnstile responses
        </li>
      </ul>
      <p>
        Lynvo doesn&apos;t ask for an email address or phone number when you
        create a username-and-password account. Lynvo doesn&apos;t ordinarily
        store the video files referenced by your links.
      </p>
    </PolicySection>

    <PolicySection title="3. Cookies and browser storage">
      <p>
        Lynvo uses cookies required for login, request security, and your theme
        choice. Your browser may also store the following items:
      </p>
      <ul className="list-disc pl-6">
        <li>Theme and player preferences</li>
        <li>Temporary link drafts that expire after up to seven days</li>
        <li>A local cache of synchronized saved-link records</li>
        <li>Remote Play session and paired-device details</li>
      </ul>
      <p>
        These items support the current browser session, preserve local
        preferences, or allow Lynvo to resume a feature. The Cookie policy lists
        the current cookie and browser-storage names. Lynvo doesn&apos;t use
        advertising cookies in the current service. If that changes, Lynvo will
        update this policy and any required consent controls before the new use
        begins.
      </p>
    </PolicySection>

    <PolicySection title="4. How Lynvo uses personal data">
      <p>Lynvo uses your data to:</p>
      <ul className="list-disc pl-6">
        <li>Authenticate your account and keep sessions active</li>
        <li>Save, organize, extract, and synchronize your links</li>
        <li>Open a playable link in the player you select</li>
        <li>Pair devices and deliver Remote Play commands</li>
        <li>Run Plugins and Custom Plugin Servers you configure</li>
        <li>Enforce storage, rate, and abuse-prevention limits</li>
        <li>Diagnose failures and protect Lynvo from unauthorized use</li>
      </ul>
      <p>
        Where data-protection law requires a lawful basis, Lynvo processes core
        account data to perform its agreement with you. Lynvo processes security
        and reliability data for its legitimate interests in operating and
        protecting Lynvo. Lynvo also processes data when required to comply with
        law.
      </p>
    </PolicySection>

    <PolicySection title="5. Providers and other recipients">
      <p>
        Lynvo doesn&apos;t sell your personal data. The following providers and
        recipients may process data when needed for a feature you use:
      </p>
      <ul className="list-disc pl-6">
        <li>
          <strong className="text-foreground">Cloudflare:</strong> website
          hosting and delivery through Workers, request security, rate limiting,
          real-time connections, and Turnstile verification. Cloudflare may
          process IP addresses, traffic-routing data, system-configuration
          information, request data, and security signals. Turnstile signals
          include the client IP address, TLS fingerprint, user-agent header,
          sitekey, and associated origin.
        </li>
        <li>
          <strong className="text-foreground">Convex:</strong> account, session,
          settings, and saved-link database services. Under the{" "}
          <ProviderPolicyLink href={CONVEX_DPA_URL}>
            Convex Data Processing Addendum
          </ProviderPolicyLink>
          , Convex acts as a processor or service provider for personal data
          Lynvo submits to the platform. Convex may use{" "}
          <ProviderPolicyLink href={CONVEX_SUBPROCESSORS_URL}>
            subprocessors
          </ProviderPolicyLink>
          , including Amazon Web Services for infrastructure and PlanetScale for
          database services, to deliver those services. Convex says the
          processing location for those two subprocessors is determined by the
          customer&apos;s selected deployment region. Lynvo&apos;s Convex
          deployment region is Europe (Ireland).
        </li>
        <li>
          <strong className="text-foreground">
            Source websites and the Lynvo Plugin Server:
          </strong>
          the URL and request data needed to inspect or resolve a link
        </li>
        <li>
          <strong className="text-foreground">
            Custom Plugin Servers you configure:
          </strong>
          the saved URL, Plugin Server API key, and Extraction request needed to
          run that Plugin Server
        </li>
        <li>
          <strong className="text-foreground">
            Just (Video) Player, VLC for Android, MPV, or MX Player:
          </strong>
          the playable URL and playback intent needed to open the video
        </li>
      </ul>
      <p>
        The other service&apos;s terms and privacy policy govern its processing
        of the data it receives. Lynvo may also disclose data when law requires
        it or when necessary to protect the rights, safety, and security of
        Lynvo or another person. Lynvo does not control how a third party uses
        data after receiving it.
      </p>
      <p>
        Provider roles can depend on the processing purpose. Cloudflare acts as
        a processor when it handles customer content, customer logs, and
        Turnstile signals to provide services to Lynvo. Cloudflare also acts as
        a controller when it creates and uses network data or processes
        Turnstile signals to improve bot detection. See Cloudflare&apos;s{" "}
        <ProviderPolicyLink href={CLOUDFLARE_PRIVACY_URL}>
          Privacy Policy
        </ProviderPolicyLink>{" "}
        and{" "}
        <ProviderPolicyLink href={CLOUDFLARE_TURNSTILE_PRIVACY_URL}>
          Turnstile Privacy Addendum
        </ProviderPolicyLink>
        .
      </p>
    </PolicySection>

    <PolicySection title="6. Credentials and security safeguards">
      <p>
        Lynvo hashes account passwords and doesn&apos;t store them as readable
        text. Lynvo encrypts Plugin Credentials with Advanced Encryption
        Standard 256-bit Galois/Counter Mode (AES-256-GCM). Lynvo stores Plugin
        Server API keys with your Plugin Server configuration and sends them to
        that Plugin Server only when Lynvo makes an authorized request.
      </p>
      <p>
        Lynvo uses access controls, request validation, rate limiting, and
        session controls to reduce risk. No online service can guarantee
        complete security. Use a unique password and revoke sessions you
        don&apos;t recognize.
      </p>
    </PolicySection>

    <PolicySection title="7. Retention and automatic deletion">
      <p>
        Saved links use a 90-day retention window by default. You can change the
        window to 7, 30, 90, or 180 days in Settings. Lynvo checks daily for
        saved links older than the selected window and deletes them. An account
        can contain up to 100 saved links within 3 MB of account-record storage;
        each saved link can use up to 1 MB.
      </p>
      <ul className="list-disc pl-6">
        <li>
          Processed Remote Play commands expire after five minutes; a cleanup
          job runs every five minutes
        </li>
        <li>
          Device-pairing codes expire after 10 minutes; a cleanup job runs every
          10 minutes
        </li>
        <li>
          Lynvo permanently deletes an account and its associated data after 90
          days (3 months) without recorded account activity
        </li>
        <li>
          Lynvo checks for inactive accounts once each day, so deletion may
          occur shortly after the 90-day threshold
        </li>
      </ul>
      <p>
        Lynvo doesn&apos;t collect an email address for inactivity notices. You
        may not receive a warning before automatic deletion. Log in and use
        Lynvo before 90 days pass to keep the account active.
      </p>
    </PolicySection>

    <PolicySection title="8. Account recovery and deletion controls">
      <p>
        <strong className="text-foreground">
          Lynvo has no forgotten-password recovery process.
        </strong>{" "}
        If you&apos;re signed in and know your current password, you can change
        it in Settings. If you sign out or lose every active session and forget
        the password, Lynvo support can&apos;t reset the password or restore
        access.
      </p>
      <p>
        You can delete saved links, clear your saved links, revoke other
        sessions, or permanently delete your account in Settings. Account
        deletion removes the account, links, Plugin configuration, stored Plugin
        credentials, Plugin Server configuration, pairing records, and sessions.
        Deleted data and automatically deleted inactive accounts can&apos;t be
        recovered through Lynvo.
      </p>
    </PolicySection>

    <PolicySection title="9. Your privacy rights and requests">
      <p>
        Depending on where you live, you may request access to, correction of,
        deletion of, restriction of, or a copy of your personal data. You may
        also object to certain processing or complain to your local
        data-protection authority.
      </p>
      <p>
        Use the controls in Settings when they cover your request. For another
        privacy request, message us privately on <TelegramSupportLink />. Lynvo
        may ask for information that verifies you control the account before
        acting on a request.
      </p>
    </PolicySection>

    <PolicySection title="10. International processing and transfers">
      <p>
        Lynvo and its service providers may process data in countries other than
        the country where you live. Those countries may have different
        data-protection laws. Cloudflare states that it primarily stores
        information in the United States and European Economic Area and may
        transfer or access information globally with appropriate safeguards. The
        Convex Data Processing Addendum authorizes international transfers,
        including transfers to the United States, and incorporates the
        applicable European Commission Standard Contractual Clauses for covered
        transfers. Lynvo&apos;s selected Convex deployment region is Europe
        (Ireland), which determines where deployments are created and the
        processing location reported by Convex for its AWS and PlanetScale
        subprocessors.
      </p>
    </PolicySection>

    <PolicySection title="11. Children's privacy">
      <p>
        Lynvo isn&apos;t directed to children under 13. Don&apos;t use Lynvo if
        you&apos;re younger than the minimum age required to consent to online
        services where you live. If you believe a child provided personal data
        in violation of this section, message us privately on{" "}
        <TelegramSupportLink />.
      </p>
    </PolicySection>

    <PolicySection title="12. Changes to this policy">
      <p>
        Lynvo may update this policy when the service or its data practices
        change. Lynvo publishes the updated version and date on this page. Lynvo
        will provide any additional notice required by law.
      </p>
    </PolicySection>

    <PolicySection title="13. Related policies">
      <p>
        The{" "}
        <Link
          to={policyPaths.termsOfUse}
          className="underline underline-offset-4"
        >
          Terms of use
        </Link>{" "}
        explain the agreement for using Lynvo. The{" "}
        <Link
          to={policyPaths.usagePolicy}
          className="underline underline-offset-4"
        >
          Usage policy
        </Link>{" "}
        explains prohibited and restricted uses.
      </p>
    </PolicySection>
  </PolicyLayout>
)
