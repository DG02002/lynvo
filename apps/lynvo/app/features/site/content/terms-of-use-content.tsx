import { Link } from "react-router"
import { PolicyLayout, PolicySection } from "~/components/policy-layout"
import {
  SupportChannelLinks,
  TelegramSupportLink,
} from "~/components/support-channel-links"
import { policyPaths } from "~/lib/paths"

const TMDB_API_TERMS_URL = "https://www.themoviedb.org/api-terms-of-use"

export const TermsOfUseContent = () => (
  <PolicyLayout title="Terms of use" updatedAt="August 25, 2026">
    <p>
      These Terms of Use govern your use of Lynvo&apos;s website, account, saved
      links, Extraction tools, device synchronization, and Remote Play features.
      By creating an account or using Lynvo, you agree to these terms. If you
      don&apos;t agree, don&apos;t create an account or use Lynvo.
    </p>
    <p>
      In these terms, <strong>Lynvo</strong> means the website and related
      hosted service. An <strong>account</strong> is the Google-based record
      used to access Lynvo. A <strong>saved link</strong> is a saved URL and its
      related metadata. A <strong>Plugin Server</strong> processes supported
      URLs. A <strong>Plugin</strong> is a Source-specific integration inside a
      Plugin Server, and a <strong>Source</strong> is the website, service, or
      URL pattern that the Plugin supports. <strong>Extraction</strong> is the
      process of resolving a supported URL into playable link information. A{" "}
      <strong>credential</strong> is a password, API key, or similar secret. A{" "}
      <strong>service provider</strong> is another organization that processes
      data or supplies infrastructure for Lynvo.
    </p>

    <PolicySection title="1. The Lynvo service">
      <p>
        Lynvo saves URLs and related metadata, resolves supported pages into
        playable links, synchronizes records across your sessions, and opens
        links in Just (Video) Player, VLC for Android, MPV, or MX Player on
        Android phones, Android tablets, and Android TV. Lynvo does not play
        video. It is a link-management and player-handoff service, not a video
        catalog, media seller, or subscription to third-party content.
      </p>
      <p>
        When enabled, Lynvo may use TMDB to add title metadata and artwork to
        your media library. TMDB is an independent service and does not supply
        the videos that your links reference. TMDB data and images are governed
        by TMDB&apos;s{" "}
        <a
          href={TMDB_API_TERMS_URL}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4"
        >
          API terms of use
        </a>{" "}
        and the rights of their respective owners.
      </p>
      <p>
        Lynvo doesn&apos;t control the websites, files, Plugins, Custom Plugin
        Servers, or video players used with Lynvo. Their own terms apply to your
        use of them.
      </p>
    </PolicySection>

    <PolicySection title="2. Eligibility and authority">
      <p>
        You must be at least 13 years old and meet the minimum age for online
        consent where you live. If local law requires permission from a parent
        or guardian, you must have that permission before using Lynvo.
      </p>
      <p>
        If you use Lynvo for an organization, you confirm that you have
        authority to accept these terms for that organization.
      </p>
    </PolicySection>

    <PolicySection title="3. Your account">
      <p>
        Lynvo uses Google OAuth only for account creation and login. Keep your
        Google account secure; you can&apos;t use Lynvo without access to the
        Google account you used to sign in. You&apos;re responsible for activity
        performed through your account and sessions.
      </p>
      <p>
        Review active sessions in Settings and revoke any session you don&apos;t
        recognize. For suspected unauthorized access, message us privately on{" "}
        <TelegramSupportLink />.
      </p>
    </PolicySection>

    <PolicySection title="4. Inactive accounts and saved-link retention">
      <p>
        Lynvo permanently deletes accounts after 90 days (3 months) without
        recorded account activity. An automated job checks once each day. Lynvo
        does not currently send a separate warning before this deletion.
      </p>
      <p>
        Log in and use Lynvo before the 90-day limit to keep the account active.
        An automatically deleted account and its saved links, credentials, and
        settings can&apos;t be recovered.
      </p>
      <p>
        Saved-link records expire separately. The default retention period is 30
        days. You can select 7, 15, or 30 days in Settings. You can also delete
        individual links or clear all saved links at any time.
      </p>
    </PolicySection>

    <PolicySection title="5. Account and request limits">
      <p>
        Each account currently has a 3 MB storage limit for account records. A
        single saved link can use up to 256 KB, and an account can contain up to
        1,000 saved links. These limits cover stored records and metadata, not
        the size of a linked video file.
      </p>
      <p>
        Lynvo Plugin Server extraction requests, including Direct Media, share
        an allowance of 30 requests per day and 200 requests per month. Custom
        Plugin Servers report and enforce their own finite limits.
      </p>
      <p>
        Lynvo may reject a record, require you to remove data, or change limits
        to protect reliability and prevent abuse. Lynvo will update these terms
        or the relevant interface if the standard limits change.
      </p>
    </PolicySection>

    <PolicySection title="6. Your links, content, and responsibilities">
      <p>
        You keep any rights you have in URLs, labels, and other information you
        submit. You give Lynvo permission to store, process, display, and send
        that data as needed to operate the features you request.
      </p>
      <p>
        TMDB metadata and artwork are third-party materials. Lynvo does not
        grant you ownership of or a separate license to reuse them. Follow the
        <a
          href={TMDB_API_TERMS_URL}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4"
        >
          TMDB API terms of use
        </a>{" "}
        and the rights of the relevant content owners.
      </p>
      <p>
        You must use Lynvo lawfully and follow the{" "}
        <Link
          to={policyPaths.usagePolicy}
          viewTransition
          className="font-normal underline underline-offset-4"
        >
          Usage policy
        </Link>
        . In particular, you may not:
      </p>
      <ul className="list-disc pl-6">
        <li>Save, access, or play content you have no legal right to use</li>
        <li>Infringe copyright, privacy, or other rights</li>
        <li>
          Distribute malware or links designed to compromise another system
        </li>
        <li>Bypass authentication, Source restrictions, or access controls</li>
        <li>
          Probe, disrupt, overload, or interfere with Lynvo or its providers
        </li>
        <li>Evade storage, Extraction, request, or rate limits</li>
        <li>Automate access without Lynvo&apos;s written permission</li>
        <li>Resell or misrepresent Lynvo as your own service</li>
      </ul>
      <p>
        You&apos;re responsible for confirming that a link, Source, or file is
        lawful before using it. Lynvo&apos;s ability to resolve a URL
        doesn&apos;t grant permission to access its content.
      </p>
    </PolicySection>

    <PolicySection title="7. Plugins, Plugin Servers, Sources, and players">
      <p>
        You may configure Plugin Domains, Plugin Credentials, and Custom Plugin
        Servers. Connect only a Plugin Server you trust. A configured Plugin
        Server may receive the Source URL, its API key, and the request data
        needed to perform Extraction.
      </p>
      <p>
        Sources can change or remove files, require authorization, block
        requests, or return unsafe material. Just (Video) Player, VLC for
        Android, MPV, and MX Player may handle links differently. Lynvo
        doesn&apos;t endorse or guarantee third-party services, files, Plugins,
        Plugin Servers, or players.
      </p>
    </PolicySection>

    <PolicySection title="8. Privacy and related policies">
      <p>
        The{" "}
        <Link
          to={policyPaths.privacyPolicy}
          viewTransition
          className="font-normal underline underline-offset-4"
        >
          Privacy policy
        </Link>{" "}
        explains what data Lynvo collects, where it goes, and when Lynvo deletes
        it. The Privacy policy forms part of these terms.
      </p>
      <p>
        The{" "}
        <Link
          to={policyPaths.cookiePolicy}
          viewTransition
          className="font-normal underline underline-offset-4"
        >
          Cookie policy
        </Link>{" "}
        explains Lynvo&apos;s cookies and browser storage. The{" "}
        <Link
          to={policyPaths.usagePolicy}
          viewTransition
          className="font-normal underline underline-offset-4"
        >
          Usage policy
        </Link>{" "}
        explains restricted uses of Lynvo and connected Plugin Servers.
      </p>
      <p>
        The{" "}
        <Link
          to={policyPaths.licenses}
          viewTransition
          className="font-normal underline underline-offset-4"
        >
          Open-source licenses
        </Link>{" "}
        page lists the licenses for Lynvo software and the attribution for
        third-party services such as TMDB.
      </p>
    </PolicySection>

    <PolicySection title="9. Account deletion, suspension, and termination">
      <p>
        You can stop using Lynvo or delete your account in Settings. Account
        deletion is permanent and removes the account data described in the
        Privacy policy.
      </p>
      <p>
        Lynvo may limit, suspend, or terminate access if you violate these
        terms, create security or legal risk, abuse Lynvo, or require resources
        that threaten Lynvo reliability. Lynvo may also remove links or
        configuration when law requires it.
      </p>
    </PolicySection>

    <PolicySection title="10. Changes and availability">
      <p>
        Lynvo is an evolving service. Features, supported Sources, the four
        supported Android players, limits, and availability may change. Lynvo
        may discontinue part or all of the hosted Lynvo service.
      </p>
      <p>
        Keep your own copy of any URL or information you can&apos;t afford to
        lose. Don&apos;t rely on Lynvo as the only record of a link, credential,
        or saved-link collection.
      </p>
    </PolicySection>

    <PolicySection title="11. Disclaimer of warranties">
      <p>
        Lynvo is provided “as is” and “as available.” To the extent law permits,
        Lynvo disclaims implied warranties of merchantability, fitness for a
        particular purpose, non-infringement, and uninterrupted or error-free
        operation.
      </p>
      <p>
        Lynvo doesn&apos;t promise that a link will resolve, remain available,
        support HTTP byte-range requests, open in a selected player, or that the
        selected player will resume a previous position or allow seeking. Lynvo
        also doesn&apos;t promise that third-party content is accurate, safe,
        lawful, or available.
      </p>
    </PolicySection>

    <PolicySection title="12. Limitation of liability">
      <p>
        To the fullest extent law permits, Lynvo and its contributors won&apos;t
        be liable for indirect, incidental, special, consequential, exemplary,
        or punitive damages. This includes loss of data, links, access, profits,
        goodwill, or use arising from Lynvo or a third-party service.
      </p>
      <p>
        Where law doesn&apos;t allow a complete exclusion, Lynvo&apos;s total
        liability for claims related to Lynvo won&apos;t exceed the amount you
        paid to Lynvo during the 12 months before the event giving rise to the
        claim. Some jurisdictions don&apos;t allow certain exclusions, so parts
        of this section may not apply to you.
      </p>
    </PolicySection>

    <PolicySection title="13. Copyright and legal reports">
      <p>
        For a rights report, use <SupportChannelLinks />. Include the URL, the
        right you own or represent, your contact details, and enough information
        to evaluate the report. Lynvo may remove access to reported material or
        suspend repeat violators when appropriate.
      </p>
    </PolicySection>

    <PolicySection title="14. Changes to these terms">
      <p>
        Lynvo may update these terms when Lynvo or legal requirements change.
        The updated date identifies the current version. Lynvo will provide
        additional notice when law requires it. Your continued use after an
        update means you accept the revised terms.
      </p>
    </PolicySection>

    <PolicySection title="15. General terms">
      <p>
        These terms and the Privacy policy form the agreement between you and
        Lynvo. If a court finds one provision unenforceable, the remaining
        provisions continue to apply. A failure to enforce a provision
        isn&apos;t a waiver of it.
      </p>
      <p>
        You may not transfer these terms without Lynvo&apos;s permission. Lynvo
        may transfer them as part of a reorganization, acquisition, or transfer
        of Lynvo. For questions about these terms, use <SupportChannelLinks />.
      </p>
    </PolicySection>
  </PolicyLayout>
)
