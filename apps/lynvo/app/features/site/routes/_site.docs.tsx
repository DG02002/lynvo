import { Link } from "react-router"
import type { Route } from "./+types/_site.docs"
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert"
import { Badge } from "~/components/ui/badge"
import { buttonVariants } from "~/components/ui/button"
import { cn } from "~/lib/utils"

interface CodeBlockProps {
  label: string
  children: string
}

const CodeBlock = ({ label, children }: CodeBlockProps) => (
  <figure className="overflow-hidden rounded-xl border bg-muted/30">
    <figcaption className="border-b px-4 py-2 text-xs text-muted-foreground">
      {label}
    </figcaption>
    <pre className="overflow-x-auto p-4 text-[0.8125rem] leading-6">
      <code>{children}</code>
    </pre>
  </figure>
)

const documentationSections = [
  { href: "#overview", label: "Overview" },
  { href: "#quickstart", label: "Quickstart" },
  { href: "#endpoints", label: "Required endpoints" },
  { href: "#manifest", label: "Manifest" },
  { href: "#authentication", label: "Authentication" },
  { href: "#usage", label: "Usage reporting" },
  { href: "#extraction", label: "Extraction flow" },
  { href: "#errors", label: "Errors" },
  { href: "#testing", label: "Test and connect" },
]

export function meta(_: Route.MetaArgs) {
  return [
    { title: "External Extractors | Lynvo Docs" },
    {
      name: "description",
      content:
        "Implement a Lynvo-compatible external extractor with an authenticated JSON protocol, finite usage reporting, staged extraction, and contract tests.",
    },
  ]
}

export default function Docs() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 md:px-8">
      <div className="grid gap-12 lg:grid-cols-[14rem_minmax(0,1fr)_12rem] lg:gap-10">
        <aside className="hidden lg:block">
          <nav
            aria-label="Documentation"
            className="sticky top-24 flex flex-col gap-7 text-sm"
          >
            <div className="flex flex-col gap-2">
              <p className="font-medium">Get started</p>
              <a
                href="#overview"
                className="rounded-md bg-muted px-3 py-2 text-foreground"
              >
                External extractors
              </a>
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-medium">Resources</p>
              <Link
                to="/changelog"
                viewTransition
                className="px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                Changelog
              </Link>
              <Link
                to="/pricing"
                viewTransition
                className="px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
              >
                Usage and plans
              </Link>
            </div>
          </nav>
        </aside>

        <article className="min-w-0 max-w-3xl">
          <header className="flex flex-col gap-5 border-b pb-10">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Docs</span>
              <span aria-hidden="true">/</span>
              <span>External extractors</span>
            </div>
            <Badge variant="secondary" className="w-fit">
              Implementation guide
            </Badge>
            <h1 className="text-4xl font-normal tracking-tight text-balance md:text-5xl">
              Build an external extractor
            </h1>
            <p className="text-lg leading-8 text-muted-foreground">
              Connect an extraction service to Lynvo through a small,
              authenticated JSON protocol.
            </p>
          </header>

          <div className="flex flex-col gap-14 py-12 [&_h2]:scroll-mt-24 [&_h3]:scroll-mt-24">
            <section id="overview" className="flex flex-col gap-5">
              <h2 className="text-3xl font-normal tracking-tight">Overview</h2>
              <p className="leading-7">
                An external extractor is an HTTPS service that tells Lynvo which
                URLs it supports and turns those URLs into normalized folders,
                lazy items, or playable media nodes. Lynvo owns the client
                experience; the worker owns source-specific extraction logic.
              </p>
              <p className="leading-7">
                The protocol is framework-agnostic. Cloudflare Workers and Hono
                are the recommended reference stack because they provide a
                compact server-first deployment without requiring a frontend.
              </p>
              <Alert>
                <AlertTitle>Keep the worker boundary small</AlertTitle>
                <AlertDescription>
                  Exchange JSON only. Never send browser cookies, UI
                  instructions, playback state, or secrets in a public manifest.
                </AlertDescription>
              </Alert>
            </section>

            <section id="quickstart" className="flex flex-col gap-5">
              <h2 className="text-3xl font-normal tracking-tight">
                Quickstart
              </h2>
              <p className="leading-7">
                Start with a minimal Worker project. Within the Lynvo monorepo,
                the protocol package is available as a workspace dependency.
                Standalone workers should consume an official published package
                or tarball when one is provided.
              </p>
              <CodeBlock label="package.json">
                {`{
  "name": "my-lynvo-extractor",
  "private": true,
  "type": "module",
  "dependencies": {
    "@lynvo/extractor-protocol": "workspace:*",
    "hono": "^4"
  }
}`}
              </CodeBlock>
              <CodeBlock label="wrangler.jsonc">
                {`{
  "name": "my-lynvo-extractor",
  "main": "src/index.ts",
  "compatibility_date": "2026-07-23"
}`}
              </CodeBlock>
              <p className="leading-7">
                Store bearer keys with the deployment provider&apos;s secret
                manager. Do not commit API keys or put them in client-side
                environment variables.
              </p>
            </section>

            <section id="endpoints" className="flex flex-col gap-5">
              <h2 className="text-3xl font-normal tracking-tight">
                Required endpoints
              </h2>
              <div className="overflow-hidden rounded-xl border">
                <div className="grid grid-cols-[7rem_1fr] border-b p-4 text-sm">
                  <code>GET /manifest</code>
                  <span className="text-muted-foreground">
                    Public capabilities and URL matchers
                  </span>
                </div>
                <div className="grid grid-cols-[7rem_1fr] border-b p-4 text-sm">
                  <code>POST /verify</code>
                  <span className="text-muted-foreground">
                    Authenticated credential verification
                  </span>
                </div>
                <div className="grid grid-cols-[7rem_1fr] border-b p-4 text-sm">
                  <code>GET /usage</code>
                  <span className="text-muted-foreground">
                    Authenticated finite usage status
                  </span>
                </div>
                <div className="grid grid-cols-[7rem_1fr] p-4 text-sm">
                  <code>POST /extract</code>
                  <span className="text-muted-foreground">
                    Authenticated source and node extraction
                  </span>
                </div>
              </div>
              <p className="leading-7">
                Use the protocol runtime to serve these routes and validate
                their inputs. Keep route handlers thin and place source-specific
                behavior in separate extractor modules.
              </p>
            </section>

            <section id="manifest" className="flex flex-col gap-5">
              <h2 className="text-3xl font-normal tracking-tight">Manifest</h2>
              <p className="leading-7">
                The public manifest identifies the extractor and lets Lynvo
                match URLs before sending protected requests.
              </p>
              <CodeBlock label="GET /manifest">
                {`{
  "protocolVersion": "1",
  "id": "my-extractor",
  "displayName": "My Extractor",
  "description": "Resolves links from Example.",
  "hasIcon": false,
  "auth": { "type": "bearer" },
  "matchers": [
    {
      "hosts": ["media.example"],
      "pathPatterns": ["/**"]
    }
  ]
}`}
              </CodeBlock>
              <p className="leading-7">
                Keep IDs stable after users connect the worker. Use HTTPS icon
                URLs, declare whether an icon exists, and never expose API keys
                or dynamic user state in this response.
              </p>
            </section>

            <section id="authentication" className="flex flex-col gap-5">
              <h2 className="text-3xl font-normal tracking-tight">
                Authentication
              </h2>
              <p className="leading-7">
                Lynvo authenticates protected routes with a bearer credential.
                Validate it before performing upstream work or reserving
                capacity.
              </p>
              <CodeBlock label="Request header">
                {`Authorization: Bearer <api-key>`}
              </CodeBlock>
              <ul className="flex list-disc flex-col gap-2 pl-5 leading-7">
                <li>Reject missing or invalid credentials consistently.</li>
                <li>Compare secrets without leaking which value failed.</li>
                <li>Never accept an API key through a query string.</li>
                <li>Rotate exposed keys and let users verify replacements.</li>
              </ul>
            </section>

            <section id="usage" className="flex flex-col gap-5">
              <h2 className="text-3xl font-normal tracking-tight">
                Usage reporting
              </h2>
              <p className="leading-7">
                Every external extractor must expose and enforce a finite
                credential-scoped allowance. Lynvo displays this separately from
                the Free plan&apos;s official extraction allowance.
              </p>
              <CodeBlock label="GET /usage">
                {`{
  "limit": 1000,
  "used": 84,
  "remaining": 916,
  "resetsAt": "2026-08-01T00:00:00.000Z"
}`}
              </CodeBlock>
              <p className="leading-7">
                Reserve usage before expensive source work begins. The same
                credential must not report one allowance while enforcing a
                different one.
              </p>
            </section>

            <section id="extraction" className="flex flex-col gap-5">
              <h2 className="text-3xl font-normal tracking-tight">
                Extraction flow
              </h2>
              <p className="leading-7">
                The extraction endpoint accepts either a source URL or a lazy
                node target. Resolve only the current stage and return
                normalized nodes.
              </p>
              <CodeBlock label="POST /extract">
                {`{
  "input": {
    "kind": "source",
    "url": "https://media.example/folder/123"
  }
}`}
              </CodeBlock>
              <CodeBlock label="Successful response">
                {`{
  "nodes": [
    {
      "kind": "playable",
      "id": "episode-1",
      "name": "Episode 1",
      "url": "https://cdn.example/video.mp4"
    }
  ]
}`}
              </CodeBlock>
              <p className="leading-7">
                A folder can contain lazy nodes. When a user opens one, Lynvo
                sends its target back as a node input. This staged model avoids
                resolving an entire tree before it is needed.
              </p>
            </section>

            <section id="errors" className="flex flex-col gap-5">
              <h2 className="text-3xl font-normal tracking-tight">Errors</h2>
              <p className="leading-7">
                Return structured protocol errors so Lynvo can present a useful
                next action. Common codes include password required, invalid
                password, unsupported URL, unauthorized, rate limited, and
                upstream unavailable.
              </p>
              <CodeBlock label="Error response">
                {`{
  "error": {
    "code": "PASSWORD_REQUIRED",
    "message": "This source requires a content password."
  }
}`}
              </CodeBlock>
              <p className="leading-7">
                Error messages should be safe to display. Do not include stack
                traces, secret values, upstream cookies, or internal network
                details.
              </p>
            </section>

            <section id="testing" className="flex flex-col gap-5">
              <h2 className="text-3xl font-normal tracking-tight">
                Test and connect
              </h2>
              <ol className="flex list-decimal flex-col gap-3 pl-5 leading-7">
                <li>Run contract tests against every required response.</li>
                <li>Deploy the worker to a stable HTTPS origin.</li>
                <li>Add the worker URL and API key in Lynvo Settings.</li>
                <li>Verify the credential and review the fetched manifest.</li>
                <li>Test a supported URL and a lazy follow-up node.</li>
                <li>Confirm usage increments and limit enforcement.</li>
              </ol>
              <Alert>
                <AlertTitle>Compatibility is a contract</AlertTitle>
                <AlertDescription>
                  Test missing authentication, malformed requests, upstream
                  failure, exhausted usage, and password-protected sources—not
                  only the successful path.
                </AlertDescription>
              </Alert>
            </section>
          </div>

          <footer className="flex flex-col items-start gap-4 border-t py-10 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Connect the worker</p>
              <p className="text-sm text-muted-foreground">
                Add it from Lynvo&apos;s external extractor settings.
              </p>
            </div>
            <Link
              to="/settings"
              viewTransition
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Open settings
            </Link>
          </footer>
        </article>

        <aside className="hidden xl:block">
          <nav
            aria-label="On this page"
            className="sticky top-24 flex flex-col gap-3 border-l pl-5 text-sm"
          >
            <p className="font-medium">On this page</p>
            {documentationSections.map((section) => (
              <a
                key={section.href}
                href={section.href}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                {section.label}
              </a>
            ))}
          </nav>
        </aside>
      </div>
    </main>
  )
}
