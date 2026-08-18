import { Link } from "react-router"
import { PolicyLayout, PolicySection } from "~/components/PolicyLayout"
import { SupportChannelLinks } from "~/components/SupportChannelLinks"
import { policyPaths } from "~/lib/paths"

export const UsagePolicyContent = () => (
  <PolicyLayout title="Usage policy" updatedAt="August 8, 2026">
    <p className="max-w-3xl text-left text-base leading-7 text-foreground">
      Lynvo helps you save and resolve links, then open them in external Android
      players through the Lynvo Plugin Server and Custom Plugin Servers. This
      policy explains how you may use Lynvo, its infrastructure, and connected
      Plugin Servers.
    </p>
    <p>
      Responsible use is shared. You are responsible for the links, content,
      credentials, and Plugin Servers you use. These rules supplement the{" "}
      <Link
        to={policyPaths.termsOfUse}
        className="underline underline-offset-4"
      >
        Terms of use
      </Link>
      .
    </p>
    <p>
      An <strong>account</strong> is the username-based record used to access
      Lynvo. A <strong>saved link</strong> is a saved URL and its related
      metadata. A <strong>Plugin Server</strong> processes supported URLs. A{" "}
      <strong>Plugin</strong> is the Source-specific integration inside that
      service, and a <strong>Source</strong> is the website, service, or URL
      pattern that the Plugin supports. <strong>Extraction</strong> is the
      process of resolving a supported URL into playable link information. A{" "}
      <strong>credential</strong> is a password, API key, or similar secret.
    </p>

    <PolicySection title="1. Use content and services you are allowed to access">
      <p>
        Use Lynvo only with links, files, services, and content that you own or
        are authorized to access. Lynvo does not grant you rights to access,
        extract, download, reproduce, share, or distribute third-party content.
      </p>
      <p>
        Follow applicable law and the terms, licenses, and access rules of each
        content provider you use with Lynvo.
      </p>
    </PolicySection>

    <PolicySection title="2. Do not bypass access controls">
      <p>You may not use Lynvo or a Custom Plugin Server to:</p>
      <ul className="list-disc pl-6">
        <li>Bypass digital rights management or technical access controls</li>
        <li>
          Evade paywalls, subscriptions, authentication, or geographic rules
        </li>
        <li>Obtain private, deleted, restricted, or unauthorized content</li>
        <li>Defeat safeguards applied by Lynvo or another service</li>
      </ul>
    </PolicySection>

    <PolicySection title="3. Protect people, privacy, and services">
      <p>
        Do not use Lynvo for illegal activity, exploitation, harassment,
        threats, fraud, phishing, credential theft, malware distribution, or
        content that violates another person&apos;s privacy or safety.
      </p>
      <p>
        You may not probe, disrupt, compromise, or gain unauthorized access to
        Lynvo, its providers, connected Plugin Servers, Source services, or
        another user&apos;s account or data.
      </p>
    </PolicySection>

    <PolicySection title="4. Protect shared capacity">
      <p>
        Do not automate requests in a way that degrades Lynvo, evade account or
        Plugin Server limits, create accounts to obtain additional allowances,
        resell access, or generate deceptive traffic or traffic unrelated to
        saving, resolving, and opening links in external Android players.
      </p>
      <p>
        Lynvo may rate-limit, reject, or temporarily pause requests to protect
        users, upstream services, and shared infrastructure.
      </p>
    </PolicySection>

    <PolicySection title="5. Follow account and request limits">
      <p>
        Each account can store up to 100 saved links within 1 MB of
        account-record storage. A single saved link can use up to 256 KB. Lynvo
        Plugin Server extraction requests, including Direct Media, share an
        allowance of 15 requests per day and 200 requests per month.
      </p>
      <p>
        Custom Plugin Servers report and enforce their own finite limits. Do not
        bypass, conceal, or misrepresent usage under any applicable limit.
      </p>
    </PolicySection>

    <PolicySection title="6. Operate Custom Plugin Servers responsibly">
      <p>
        You are responsible for every Custom Plugin Server you connect, operate,
        or distribute. Custom Plugin Servers must use the Plugin Server Protocol
        honestly, report finite usage accurately, authenticate protected
        endpoints, validate inputs, and avoid exposing credentials or private
        data.
      </p>
      <p>
        Do not configure a Plugin Server that impersonates another service,
        misrepresents supported Sources, returns malicious links, or performs
        undisclosed actions.
      </p>
    </PolicySection>

    <PolicySection title="7. Protect credentials">
      <p>
        Protect your Lynvo password, sessions, Plugin Credentials, and Custom
        Plugin Server API keys. Do not publish or share credentials, and revoke
        or rotate them if you believe they have been exposed.
      </p>
    </PolicySection>

    <PolicySection title="8. How Lynvo enforces this policy">
      <p>
        Lynvo may limit features, suspend requests, remove integrations, or
        terminate access when reasonably necessary to investigate or stop a
        policy violation, protect Lynvo, comply with law, or prevent harm.
        Serious or repeated violations may result in permanent account deletion.
      </p>
    </PolicySection>

    <PolicySection title="9. Report abuse and policy changes">
      <p>
        To report suspected abuse or an unsafe Plugin Server, use{" "}
        <SupportChannelLinks />. Include enough information for the report to be
        reviewed without sharing passwords or API keys.
      </p>
      <p>
        Lynvo may update this policy as Lynvo and its risks change. The updated
        date at the top of this page identifies the current version.
      </p>
      <p>
        The{" "}
        <Link
          to={policyPaths.privacyPolicy}
          className="underline underline-offset-4"
        >
          Privacy policy
        </Link>{" "}
        explains how Lynvo handles data related to these uses.
      </p>
    </PolicySection>
  </PolicyLayout>
)
