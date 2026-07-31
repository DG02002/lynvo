import { PolicyLayout, PolicySection } from "~/components/PolicyLayout"

export const PrivacyPolicyContent = () => (
  <PolicyLayout title="Privacy policy" updatedAt="July 31, 2026">
    <p className="max-w-3xl text-left text-base leading-7 text-foreground">
      This policy explains what Lynvo stores when you create an account, save a
      link, connect a device, or configure a Plugin. It also explains automatic
      deletion, account controls, and when another service receives data.
    </p>
    <p>
      In this policy, <strong>Lynvo</strong> means the website and related
      service; an <strong>account</strong> is the username-based record used to
      access Lynvo; and a <strong>Recent Link</strong> is a saved URL and its
      related metadata. A <strong>Plugin Server</strong> processes supported
      URLs, a <strong>Plugin</strong> is its Source-specific integration, and a
      <strong>Source</strong> is the website, service, or URL pattern the Plugin
      supports. A <strong>credential</strong> is a password, API key, or similar
      secret. A <strong>service provider</strong> is another organization that
      processes data or supplies infrastructure for Lynvo.
    </p>

    <PolicySection title="1. Who operates Lynvo and how to contact us">
      <p>
        Lynvo operates the Lynvo website and related link-saving, Extraction,
        synchronization, and remote-play features described in this policy. Use
        the official contact method displayed by Lynvo for privacy questions or
        requests.
      </p>
    </PolicySection>

    <PolicySection title="2. Data Lynvo collects">
      <p>
        Lynvo collects the data needed to run your account and the features you
        choose to use:
      </p>
      <ul className="list-disc pl-6">
        <li>
          <strong className="text-foreground">Account data:</strong> your
          username, password hash, account creation date, and last-active date
        </li>
        <li>
          <strong className="text-foreground">Saved-link data:</strong> URLs,
          titles, Source details, extracted file and folder metadata, watch
          state, and record timestamps
        </li>
        <li>
          <strong className="text-foreground">Settings:</strong> player
          preferences, saved-link retention choice, Plugin domains, and enabled
          Custom Plugin Servers
        </li>
        <li>
          <strong className="text-foreground">Credentials you add:</strong>
          Plugin domain passwords and Plugin Server API keys
        </li>
        <li>
          <strong className="text-foreground">Session data:</strong> session
          identifiers, device names, login and activity times, device pairing
          codes, and short-lived remote commands
        </li>
        <li>
          <strong className="text-foreground">
            Security and diagnostic data:
          </strong>
          request details, error information, rate-limit records, and Cloudflare
          Turnstile responses
        </li>
      </ul>
      <p>
        Lynvo doesn&apos;t ask for an email address or phone number when you
        create a username-and-password account. Lynvo doesn&apos;t ordinarily
        store the video files referenced by your links.
      </p>
    </PolicySection>

    <PolicySection title="3. Data stored on your device">
      <p>
        Lynvo uses cookies required for login, request security, and your theme
        choice. The browser may also store your theme, player defaults, and a
        temporary real-time session identifier. These items keep your session
        working and remember settings on that browser.
      </p>
      <p>
        Lynvo doesn&apos;t use advertising cookies in the current Lynvo service.
        If that changes, this policy and any required consent controls will
        change before the new use begins.
      </p>
    </PolicySection>

    <PolicySection title="4. How Lynvo uses data">
      <p>Lynvo uses your data for the following purposes:</p>
      <ul className="list-disc pl-6">
        <li>Authenticate your account and keep sessions active</li>
        <li>Save, organize, extract, and synchronize your links</li>
        <li>Open a playable link in the player you select</li>
        <li>Pair devices and deliver remote-play commands</li>
        <li>Run Plugins and Custom Plugin Servers you configure</li>
        <li>Enforce storage, rate, and abuse-prevention limits</li>
        <li>Diagnose failures and protect Lynvo from unauthorized use</li>
      </ul>
      <p>
        Where data-protection law requires a lawful basis, Lynvo processes core
        account data to perform its agreement with you. Lynvo processes security
        and reliability data for legitimate interests in operating and
        protecting Lynvo. Lynvo also processes data when needed to comply with
        law.
      </p>
    </PolicySection>

    <PolicySection title="5. When data goes to another service">
      <p>
        Lynvo doesn&apos;t sell your personal data. The following providers or
        recipients may process data when needed for a feature you use:
      </p>
      <ul className="list-disc pl-6">
        <li>
          <strong className="text-foreground">Cloudflare:</strong> website
          delivery, request security, rate limiting, real-time connections, and
          Turnstile verification
        </li>
        <li>
          <strong className="text-foreground">Convex:</strong> account, session,
          settings, and saved-link database services
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
            Android players you select:
          </strong>
          the playable URL and playback intent needed to open the video
        </li>
      </ul>
      <p>
        Another service&apos;s terms and privacy policy govern its processing.
        Lynvo may also disclose data when law requires it, or when necessary to
        protect the rights, safety, and security of Lynvo or another person.
      </p>
    </PolicySection>

    <PolicySection title="6. Credentials and security">
      <p>
        Lynvo hashes account passwords and doesn&apos;t store them as readable
        text. Lynvo encrypts Plugin domain passwords with Advanced Encryption
        Standard 256-bit Galois/Counter Mode (AES-256-GCM). Plugin Server API
        keys are stored with your Plugin Server configuration and are sent to
        that Plugin Server when Lynvo makes an authorized request.
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
        Recent Links use a 90-day retention window by default. You can change it
        to 7, 30, 90, or 180 days in Settings. Lynvo checks daily for Recent
        Links older than the selected window and deletes them. An account can
        contain up to 100 Recent Links within 3 MB of account-record storage;
        each Recent Link can use up to 1 MB.
      </p>
      <ul className="list-disc pl-6">
        <li>Processed remote commands expire after five minutes</li>
        <li>Expired device-pairing codes are removed regularly</li>
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

    <PolicySection title="8. Account recovery and deletion">
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
        You can delete saved links, clear your history, revoke other sessions,
        or permanently delete your account in Settings. Account deletion removes
        the account, links, Plugin configuration, stored Plugin credentials,
        Plugin Server configuration, pairing records, and sessions. Deleted data
        and automatically deleted inactive accounts can&apos;t be recovered
        through Lynvo.
      </p>
    </PolicySection>

    <PolicySection title="9. Your privacy rights">
      <p>
        Depending on where you live, you may request access to, correction of,
        deletion of, restriction of, or a copy of your personal data. You may
        also object to certain processing or complain to your local
        data-protection authority.
      </p>
      <p>
        Use the controls in Settings when they cover your request. For another
        privacy request, use the official contact method displayed by Lynvo.
        Lynvo may need information that verifies you control the account before
        acting on a request.
      </p>
    </PolicySection>

    <PolicySection title="10. International processing">
      <p>
        Lynvo and its service providers may process data in countries other than
        the country where you live. Those countries may have different
        data-protection laws. Lynvo relies on provider safeguards and other
        lawful transfer mechanisms where applicable.
      </p>
    </PolicySection>

    <PolicySection title="11. Children's privacy">
      <p>
        Lynvo isn&apos;t directed to children under 13. Don&apos;t use Lynvo if
        you&apos;re younger than the minimum age required to consent to online
        services where you live. Use the official contact method displayed by
        Lynvo if you believe a child provided personal data in violation of this
        section.
      </p>
    </PolicySection>

    <PolicySection title="12. Policy changes">
      <p>
        Lynvo may update this policy when the Lynvo service or its data
        practices change. The updated date shows when the current version took
        effect. Lynvo will provide any additional notice required by law.
      </p>
    </PolicySection>
  </PolicyLayout>
)
