import { Link } from "react-router"
import { PolicyLayout, PolicySection } from "~/components/PolicyLayout"
import { policyPaths } from "~/lib/paths"

export const TermsOfUseContent = () => (
  <PolicyLayout title="Terms of use" updatedAt="July 11, 2026">
    <p>
      These terms govern your use of Lynvo&apos;s website, account, saved-link
      library, extraction tools, device synchronization, and remote-play
      features. By creating an account or using Lynvo, you agree to these terms.
    </p>

    <PolicySection title="1. What Lynvo does">
      <p>
        Lynvo saves URLs and related metadata, resolves supported pages into
        playable links, synchronizes records across your sessions, and launches
        links in compatible Android players. Lynvo is a link-management and
        playback-launching service. It isn&apos;t a video catalog, media seller,
        or subscription to third-party content.
      </p>
      <p>
        Lynvo doesn&apos;t control the websites, files, plugins, external
        workers, or video players you use with the Service. Their own terms
        apply.
      </p>
    </PolicySection>

    <PolicySection title="2. Eligibility and your agreement">
      <p>
        You must be at least 13 years old and meet the minimum age for online
        consent where you live. If local law requires permission from a parent
        or guardian, you must have that permission before using Lynvo.
      </p>
      <p>
        If you use Lynvo for an organization, you confirm that you can accept
        these terms for that organization.
      </p>
    </PolicySection>

    <PolicySection title="3. Your account and password">
      <p>
        You must provide an available username and create a password that meets
        Lynvo&apos;s security rules. Keep your credentials private. You&apos;re
        responsible for activity performed through your account and sessions.
      </p>
      <p>
        <strong className="text-foreground">
          Lynvo doesn&apos;t collect an email address and can&apos;t recover a
          forgotten password.
        </strong>{" "}
        You can change your password while signed in if you know the current
        password. If you&apos;re signed out, have no active session, and forget
        the password, you will permanently lose access to the account and its
        data. Support can&apos;t reset or bypass the password.
      </p>
      <p>
        Review active sessions in Settings and revoke any session you don&apos;t
        recognize. Use the official contact method displayed by the Service if
        you suspect unauthorized access.
      </p>
    </PolicySection>

    <PolicySection title="4. Inactive accounts and saved-link retention">
      <p>
        Lynvo permanently deletes accounts after 90 days (3 months) without
        recorded account activity. An automated job checks once each day.
        Because Lynvo doesn&apos;t collect your email address, deletion may
        occur without a separate warning.
      </p>
      <p>
        Sign in and use Lynvo before the 90-day limit to keep the account
        active. An automatically deleted account, username configuration, saved
        links, credentials, and settings can&apos;t be recovered.
      </p>
      <p>
        Saved-link records expire separately. The default retention period is 90
        days. You can select 7, 30, 90, or 180 days in Settings. You can also
        delete individual links or clear all saved-link history at any time.
      </p>
    </PolicySection>

    <PolicySection title="5. Account and storage limits">
      <p>
        Each account currently has a 3 MB storage limit for account records. A
        single saved-link record can use up to 1 MB. These limits cover stored
        records and metadata, not the size of a linked video file.
      </p>
      <p>
        Lynvo may reject a record, require you to remove data, or change limits
        to protect reliability and prevent abuse. Lynvo will update these terms
        or the relevant interface if the standard limits change.
      </p>
    </PolicySection>

    <PolicySection title="6. Your links and responsibilities">
      <p>
        You keep any rights you have in URLs, labels, and other information you
        submit. You give Lynvo permission to store, process, display, and send
        that data as needed to operate the features you request.
      </p>
      <p>You must use Lynvo lawfully. In particular, don&apos;t:</p>
      <ul className="list-disc pl-6">
        <li>Save, access, or play content you have no legal right to use</li>
        <li>Infringe copyright, privacy, or other rights</li>
        <li>
          Distribute malware or links designed to compromise another system
        </li>
        <li>Bypass authentication, source restrictions, or access controls</li>
        <li>
          Probe, disrupt, overload, or interfere with Lynvo or its providers
        </li>
        <li>Evade storage, extraction, request, or rate limits</li>
        <li>Automate access without Lynvo&apos;s written permission</li>
        <li>Resell or misrepresent Lynvo as your own service</li>
      </ul>
      <p>
        You&apos;re responsible for confirming that a link, source, or file is
        lawful before using it. Lynvo&apos;s ability to resolve a URL
        doesn&apos;t grant permission to access its content.
      </p>
    </PolicySection>

    <PolicySection title="7. Plugins, Plugin Servers, Sources, and players">
      <p>
        You may configure plugin domains, source credentials, and external
        Custom Plugin Servers. Only connect a Plugin Server you trust. A
        configured Plugin Server may receive the Source URL, its API key, and
        request data needed to perform extraction.
      </p>
      <p>
        Source sites can change or remove files, require authorization, block
        requests, or return unsafe material. Android players may handle links
        differently. Lynvo doesn&apos;t endorse or guarantee third-party
        services, files, Plugins, Plugin Servers, or players.
      </p>
    </PolicySection>

    <PolicySection title="8. Privacy">
      <p>
        The{" "}
        <Link
          to={policyPaths.privacyPolicy}
          viewTransition
          className="font-normal underline underline-offset-4"
        >
          Lynvo Privacy Policy
        </Link>{" "}
        explains what data Lynvo collects, where it goes, and when it is
        deleted. The Privacy Policy forms part of these terms.
      </p>
    </PolicySection>

    <PolicySection title="9. Account deletion, suspension, and termination">
      <p>
        You can stop using Lynvo or delete your account in Settings. Account
        deletion is permanent and removes the account data described in the
        Privacy Policy.
      </p>
      <p>
        Lynvo may limit, suspend, or terminate access if you violate these
        terms, create security or legal risk, abuse the Service, or require
        resources that threaten Service reliability. Lynvo may also remove links
        or configuration when law requires it.
      </p>
    </PolicySection>

    <PolicySection title="10. Service changes and availability">
      <p>
        Lynvo is an evolving service. Features, supported sources, players,
        limits, and availability may change. Lynvo may discontinue part or all
        of the Service.
      </p>
      <p>
        Keep your own copy of any URL or information you can&apos;t afford to
        lose. Don&apos;t rely on Lynvo as the only record of a link, credential,
        or watchlist.
      </p>
    </PolicySection>

    <PolicySection title="11. No warranties">
      <p>
        Lynvo is provided “as is” and “as available.” To the extent law permits,
        Lynvo disclaims implied warranties of merchantability, fitness for a
        particular purpose, non-infringement, and uninterrupted or error-free
        operation.
      </p>
      <p>
        Lynvo doesn&apos;t promise that a link will resolve, remain available,
        support resume, open in a selected player, or stay synchronized. Lynvo
        also doesn&apos;t promise that third-party content is accurate, safe,
        lawful, or available.
      </p>
    </PolicySection>

    <PolicySection title="12. Limits on liability">
      <p>
        To the fullest extent law permits, Lynvo and its contributors won&apos;t
        be liable for indirect, incidental, special, consequential, exemplary,
        or punitive damages. This includes loss of data, links, access, profits,
        goodwill, or use arising from Lynvo or a third-party service.
      </p>
      <p>
        Where law doesn&apos;t allow a complete exclusion, Lynvo&apos;s total
        liability for claims related to the Service won&apos;t exceed the amount
        you paid to Lynvo during the 12 months before the event giving rise to
        the claim. Some jurisdictions don&apos;t allow certain exclusions, so
        parts of this section may not apply to you.
      </p>
    </PolicySection>

    <PolicySection title="13. Copyright and legal reports">
      <p>
        Use the official contact method displayed by the Service if you believe
        a link or use of Lynvo violates your rights. Include the URL, the right
        you own or represent, your contact details, and enough information to
        evaluate the report. Lynvo may remove access to reported material or
        suspend repeat violators when appropriate.
      </p>
    </PolicySection>

    <PolicySection title="14. Changes to these terms">
      <p>
        Lynvo may update these terms when the Service or legal requirements
        change. The updated date identifies the current version. Lynvo will
        provide additional notice when law requires it. Your continued use after
        an update means you accept the revised terms.
      </p>
    </PolicySection>

    <PolicySection title="15. General terms">
      <p>
        These terms and the Privacy Policy form the agreement between you and
        Lynvo about the Service. If a court finds one provision unenforceable,
        the remaining provisions continue to apply. A failure to enforce a
        provision isn&apos;t a waiver of it.
      </p>
      <p>
        You may not transfer these terms without Lynvo&apos;s permission. Lynvo
        may transfer them as part of a reorganization, acquisition, or transfer
        of the Service. Use the official contact method displayed by the Service
        with questions about these terms.
      </p>
    </PolicySection>
  </PolicyLayout>
)
