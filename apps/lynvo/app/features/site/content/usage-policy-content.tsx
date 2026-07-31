import { PolicyLayout, PolicySection } from "~/components/PolicyLayout"

export const UsagePolicyContent = () => (
  <PolicyLayout title="Usage policies" updatedAt="July 23, 2026">
    <p className="max-w-3xl text-left text-base leading-7 text-foreground">
      Lynvo helps you save, resolve, and play links through official and Custom
      Plugin Servers. These policies explain the responsible and permitted use
      of Lynvo, its infrastructure, and any Plugin Server connected to it.
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
      <p>You may not use Lynvo or an Custom Plugin Server to:</p>
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
        Do not automate requests in a way that degrades the Service, evade
        account or Plugin Server limits, create accounts to obtain additional
        quotas, resell access, or generate traffic that is excessive, deceptive,
        or unrelated to ordinary personal use.
      </p>
      <p>
        Lynvo may rate-limit, reject, or temporarily pause requests to protect
        users, upstream services, and shared infrastructure.
      </p>
    </PolicySection>

    <PolicySection title="5. Custom Plugin Server responsibilities">
      <p>
        You are responsible for every Custom Plugin Server you connect, operate,
        or distribute. Custom Plugin Servers must use the Lynvo protocol
        honestly, report finite usage accurately, authenticate protected
        endpoints, validate inputs, and avoid exposing credentials or private
        data.
      </p>
      <p>
        Do not configure a Plugin Server that impersonates another service,
        misrepresents supported sources, returns malicious links, or performs
        undisclosed actions.
      </p>
    </PolicySection>

    <PolicySection title="6. Keep credentials secure">
      <p>
        Protect your Lynvo password, sessions, source credentials, and external
        Plugin Server API keys. Do not publish or share credentials, and revoke
        or rotate them if you believe they have been exposed.
      </p>
    </PolicySection>

    <PolicySection title="7. Enforcement">
      <p>
        Lynvo may limit features, suspend requests, remove integrations, or
        terminate access when reasonably necessary to investigate or stop a
        policy violation, protect the Service, comply with law, or prevent harm.
        Serious or repeated violations may result in permanent account deletion.
      </p>
    </PolicySection>

    <PolicySection title="8. Reporting and policy changes">
      <p>
        Use the official contact method displayed by the Service to report
        suspected abuse or an unsafe Plugin Server. Include enough information
        for the report to be reviewed without sharing passwords or API keys.
      </p>
      <p>
        Lynvo may update these policies as the Service and its risks change. The
        updated date at the top of this page identifies the current version.
      </p>
    </PolicySection>
  </PolicyLayout>
)
