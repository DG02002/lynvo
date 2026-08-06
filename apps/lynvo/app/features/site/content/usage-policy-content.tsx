import { PolicyLayout, PolicySection } from "~/components/PolicyLayout"
import { SupportChannelLinks } from "~/components/SupportChannelLinks"

export const UsagePolicyContent = () => (
  <PolicyLayout title="Usage policy" updatedAt="August 1, 2026">
    <p className="max-w-3xl text-left text-base leading-7 text-foreground">
      Lynvo helps you save and resolve links, then open them in external Android
      players through the Lynvo Plugin Server and Custom Plugin Servers. This
      policy explains permitted use of Lynvo, its infrastructure, and any
      connected Plugin Server.
    </p>
    <p>
      An <strong>account</strong> is the username-based record used to access
      Lynvo, and a <strong>saved link</strong> is a saved URL and its related
      metadata. A <strong>Plugin Server</strong> processes supported URLs. A{" "}
      <strong>Plugin</strong> is the Source-specific integration inside that
      service, and a <strong>Source</strong> is the website, service, or URL
      pattern the Plugin supports. A <strong>credential</strong> is a password,
      API key, or similar secret.
    </p>

    <PolicySection title="1. Use content you are allowed to access">
      <p>
        You may use Lynvo only with links, files, services, and content that you
        own or are authorized to access. Lynvo does not grant you rights to
        access, extract, download, reproduce, share, or distribute third-party
        content.
      </p>
      <p>
        You are responsible for following applicable law and the terms,
        licenses, and access rules of each content provider you use with Lynvo.
      </p>
    </PolicySection>

    <PolicySection title="2. Do not bypass protections">
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

    <PolicySection title="3. Protect people and services">
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

    <PolicySection title="4. Do not abuse capacity">
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
        Each account can store up to 100 saved links within 3 MB of
        account-record storage. A single saved link can use up to 1 MB. Lynvo
        Plugin Server and Direct Media requests share an allowance of 15
        requests per day and 200 requests per month.
      </p>
      <p>
        Custom Plugin Servers report and enforce their own finite limits. Do not
        bypass, conceal, or misrepresent usage under any applicable limit.
      </p>
    </PolicySection>

    <PolicySection title="6. Custom Plugin Server responsibilities">
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

    <PolicySection title="7. Keep credentials secure">
      <p>
        Protect your Lynvo password, sessions, Plugin Domain credentials, and
        Custom Plugin Server API keys. Do not publish or share credentials, and
        revoke or rotate them if you believe they have been exposed.
      </p>
    </PolicySection>

    <PolicySection title="8. Enforcement">
      <p>
        Lynvo may limit features, suspend requests, remove integrations, or
        terminate access when reasonably necessary to investigate or stop a
        policy violation, protect Lynvo, comply with law, or prevent harm.
        Serious or repeated violations may result in permanent account deletion.
      </p>
    </PolicySection>

    <PolicySection title="9. Reporting and policy changes">
      <p>
        To report suspected abuse or an unsafe Plugin Server, use{" "}
        <SupportChannelLinks />. Include enough information for the report to be
        reviewed without sharing passwords or API keys.
      </p>
      <p>
        Lynvo may update this policy as Lynvo and its risks change. The updated
        date at the top of this page identifies the current version.
      </p>
    </PolicySection>
  </PolicyLayout>
)
