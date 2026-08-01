import { PolicyLayout, PolicySection } from "~/components/PolicyLayout"
import { SupportChannelLinks } from "~/components/SupportChannelLinks"

const LYNVO_SOURCE_URL = "https://github.com/DG02002/lynvo"
const LYNVO_LICENSE_URL = "https://github.com/DG02002/lynvo/blob/main/LICENSE"
const PROTOCOL_LICENSE_URL =
  "https://github.com/DG02002/lynvo/blob/main/packages/plugin-server-protocol/LICENSE"
const CREATOR_LICENSE_URL =
  "https://github.com/DG02002/lynvo/blob/main/packages/create-lynvo-plugin-server/LICENSE"

const ExternalLink = ({
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

export const LicensesContent = () => (
  <PolicyLayout title="Open-source licenses" updatedAt="August 1, 2026">
    <p>
      Lynvo includes open-source software. This page identifies the licenses for
      the Lynvo core project and the independently licensed packages in the
      repository.
    </p>

    <PolicySection title="Lynvo core">
      <p>
        The Lynvo core project is licensed under the GNU Affero General Public
        License, version 3 (AGPL-3.0). The full license text is available in the
        repository&apos;s{" "}
        <ExternalLink href={LYNVO_LICENSE_URL}>LICENSE file</ExternalLink>.
      </p>
      <p>
        Copyright © 2026 Lynvo contributors. The software is provided without
        warranty under the terms of AGPL-3.0. The license explains the rights to
        use, modify, convey, and distribute the covered source code and how to
        obtain the corresponding source when those obligations apply.
      </p>
    </PolicySection>

    <PolicySection title="Independently licensed packages">
      <p>
        The Plugin Server protocol package{" "}
        <strong>@dg02002/lynvo-plugin-server-protocol</strong> and the{" "}
        <strong>create-lynvo-plugin-server</strong> package are separately
        licensed under the MIT License. Read the{" "}
        <ExternalLink href={PROTOCOL_LICENSE_URL}>
          protocol package license
        </ExternalLink>{" "}
        and the{" "}
        <ExternalLink href={CREATOR_LICENSE_URL}>
          creator package license
        </ExternalLink>
        .
      </p>
      <p>
        Package licenses apply to the packages they cover. They do not change
        the license of the Lynvo core project.
      </p>
    </PolicySection>

    <PolicySection title="Hosted service and third-party content">
      <p>
        A software license is separate from the terms for the hosted Lynvo
        service, account data, privacy practices, service availability, Lynvo
        trademarks, and third-party services.
      </p>
      <p>
        AGPL-3.0 and the MIT License do not grant rights to access, extract,
        download, reproduce, or distribute content from a Source. Follow the
        rights, licenses, and access rules of each Source, Plugin Server, and
        player you use.
      </p>
      <p>
        A Custom Plugin Server may have its own license, terms, privacy policy,
        and source-site obligations. Review those terms before connecting to or
        distributing one.
      </p>
    </PolicySection>

    <PolicySection title="Source and support">
      <p>
        The Lynvo source repository is available at{" "}
        <ExternalLink href={LYNVO_SOURCE_URL}>
          github.com/DG02002/lynvo
        </ExternalLink>
        . For private questions, message us on <SupportChannelLinks />.
      </p>
      <p>
        Open-source licensing questions and legal reports should include enough
        context for review. Do not post passwords, API keys, or other secrets in
        a public GitHub issue.
      </p>
    </PolicySection>
  </PolicyLayout>
)
