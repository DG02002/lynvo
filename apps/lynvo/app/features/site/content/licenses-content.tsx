import { Link } from "react-router"
import { PolicyLayout, PolicySection } from "~/components/policy-layout"
import { SupportChannelLinks } from "~/components/support-channel-links"
import { policyPaths } from "~/lib/paths"

const LYNVO_SOURCE_URL = "https://github.com/DG02002/lynvo"
const LYNVO_LICENSE_URL = "https://github.com/DG02002/lynvo/blob/main/LICENSE"
const PROTOCOL_LICENSE_URL =
  "https://github.com/DG02002/lynvo/blob/main/packages/plugin-server-protocol/LICENSE"
const CREATOR_LICENSE_URL =
  "https://github.com/DG02002/lynvo/blob/main/packages/create-lynvo-plugin-server/LICENSE"
const TMDB_WEBSITE_URL = "https://www.themoviedb.org"
const TMDB_API_TERMS_URL = "https://www.themoviedb.org/api-terms-of-use"
const TMDB_LOGOS_ATTRIBUTION_URL =
  "https://www.themoviedb.org/about/logos-attribution"
const TMDB_LOGO_URL =
  "https://www.themoviedb.org/assets/v4/logos/v2/blue_square_2-d537fb228cf3ded904ef09b136fe3fec72548ebc1fea3fbbd1ad9e36364db38b.svg"
const TMDB_ATTRIBUTION_NOTICE =
  "This product uses TMDB and the TMDB APIs but is not endorsed, certified, or otherwise approved by TMDB."

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
  <PolicyLayout title="Open-source licenses" updatedAt="August 25, 2026">
    <p>
      Lynvo includes open-source software. This page identifies the licenses for
      the Lynvo core project, the independently licensed packages in the
      repository, and the attribution required for TMDB content used by the
      media library.
    </p>

    <PolicySection title="Lynvo core">
      <p>
        The Lynvo core project is licensed under the GNU Affero General Public
        License, version 3 (AGPL-3.0). The full license text is available in the
        repository&apos;s{" "}
        <ExternalLink href={LYNVO_LICENSE_URL}>LICENSE file</ExternalLink>.
      </p>
      <p>
        Copyright © 2026 Lynvo. The software is provided without warranty under
        the terms of AGPL-3.0. The license explains the rights to use, modify,
        convey, and distribute the covered source code and how to obtain the
        corresponding source when those obligations apply.
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
        trademarks, and third-party services. See the{" "}
        <Link
          to={policyPaths.termsOfUse}
          className="underline underline-offset-4"
        >
          Terms of use
        </Link>{" "}
        and{" "}
        <Link
          to={policyPaths.privacyPolicy}
          className="underline underline-offset-4"
        >
          Privacy policy
        </Link>{" "}
        for those separate rules.
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

    <PolicySection title="TMDB attribution">
      <p>
        <a
          href={TMDB_WEBSITE_URL}
          target="_blank"
          rel="noreferrer"
          className="not-typeset inline-block"
        >
          <img
            src={TMDB_LOGO_URL}
            alt="TMDB"
            className="block h-32 w-auto"
            loading="lazy"
            data-not-typeset
            width="185"
            height="133"
          />
        </a>
      </p>
      <p>
        When the server-side TMDB credential is configured, Lynvo uses the TMDB
        APIs for optional title metadata and artwork. The credential is not
        required for the media library to work. Lynvo does not claim ownership
        of TMDB data, images, or trademarks.
      </p>
      <p>{TMDB_ATTRIBUTION_NOTICE}</p>
      <p>
        Lynvo&apos;s AGPL-3.0 and MIT software licenses do not grant rights to
        use TMDB Content, meaning metadata and images returned by the TMDB APIs,
        or the TMDB trademarks. TMDB API use is governed by the{" "}
        <ExternalLink href={TMDB_API_TERMS_URL}>
          TMDB API terms of use
        </ExternalLink>{" "}
        and the rights of the relevant content owners. TMDB&apos;s API terms
        require a separate written agreement for commercial use. If Lynvo&apos;s
        use becomes commercial, obtain that agreement before continuing to use
        TMDB through Lynvo.
      </p>
      <p>
        The current Lynvo implementation marks TMDB metadata cache entries as
        stale after 180 days. Lynvo may retain title metadata in the media
        library until the related title group or account data is deleted.
      </p>
      <p>
        Read the{" "}
        <ExternalLink href={TMDB_LOGOS_ATTRIBUTION_URL}>
          TMDB logos and attribution guidance
        </ExternalLink>
        . The TMDB logo shown here is linked to TMDB and is displayed in an
        approved form that is less prominent than Lynvo branding.
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
