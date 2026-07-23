import { useEffect, useRef, useState } from "react"
import { Link } from "react-router"

import type { Route } from "./+types/_site.docs"
import { buttonVariants } from "~/components/ui/button"
import DocsContent from "~/features/site/docs/external-extractors.mdx"
import { docsComponents } from "~/features/site/docs/docs-components"
import { cn } from "~/lib/utils"

const documentationSections = [
  { href: "#overview", label: "Build an extractor" },
  { href: "#prerequisites", label: "Prerequisites" },
  { href: "#create-worker", label: "Create the Worker" },
  { href: "#protocol-version", label: "Protocol version 1.0" },
  { href: "#authentication", label: "Authentication" },
  { href: "#manifest", label: "Manifest schema" },
  { href: "#sources", label: "Source adapters" },
  { href: "#request-schema", label: "Request schema" },
  { href: "#node-schema", label: "Node schema" },
  { href: "#success-schema", label: "Success schema" },
  { href: "#usage-schema", label: "Usage limits" },
  { href: "#error-schema", label: "Error schema" },
  { href: "#routes", label: "Hono routes" },
  { href: "#testing", label: "Contract tests" },
  { href: "#deployment", label: "Deploy" },
  { href: "#connect", label: "Connect to Lynvo" },
] as const

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Build an external extractor | Lynvo Docs" },
    {
      name: "description",
      content:
        "Create, test, deploy, and connect a Lynvo-compatible external extractor using Hono and Cloudflare Workers.",
    },
    { name: "contentType", content: "Tutorial" },
  ]
}

export default function Docs() {
  const sectionNavRef = useRef<HTMLElement>(null)
  const progressBarRef = useRef<HTMLSpanElement>(null)
  const activeIndicatorRef = useRef<HTMLSpanElement>(null)
  const [activeSection, setActiveSection] = useState<string>(
    documentationSections[0].href
  )

  useEffect(() => {
    let frameId = 0

    const updateActiveSection = () => {
      frameId = 0
      const activationLine = Math.min(window.innerHeight * 0.3, 180)
      let nextActiveSection: string = documentationSections[0].href
      let firstSectionTop: number | undefined
      let lastSectionTop: number | undefined

      for (const [index, section] of documentationSections.entries()) {
        const element = document.getElementById(section.href.slice(1))
        if (!element) {
          continue
        }

        const sectionTop = element.getBoundingClientRect().top
        if (index === 0) {
          firstSectionTop = sectionTop
        }
        if (index === documentationSections.length - 1) {
          lastSectionTop = sectionTop
        }
        if (sectionTop <= activationLine) {
          nextActiveSection = section.href
        }
      }

      if (
        progressBarRef.current &&
        firstSectionTop !== undefined &&
        lastSectionTop !== undefined
      ) {
        const sectionRange = lastSectionTop - firstSectionTop
        const progress =
          sectionRange === 0
            ? 0
            : Math.min(
                Math.max((activationLine - firstSectionTop) / sectionRange, 0),
                1
              )
        progressBarRef.current.style.transform = `scaleY(${progress})`
      }

      const activeLink =
        sectionNavRef.current?.querySelector<HTMLAnchorElement>(
          `a[href="${nextActiveSection}"]`
        )
      if (activeIndicatorRef.current && activeLink) {
        activeIndicatorRef.current.style.height = `${activeLink.offsetHeight}px`
        activeIndicatorRef.current.style.transform = `translateY(${activeLink.offsetTop}px)`
      }

      setActiveSection(nextActiveSection)
    }

    const scheduleUpdate = () => {
      if (frameId === 0) {
        frameId = window.requestAnimationFrame(updateActiveSection)
      }
    }

    updateActiveSection()
    document.addEventListener("scroll", scheduleUpdate, {
      capture: true,
      passive: true,
    })
    window.addEventListener("resize", scheduleUpdate)

    return () => {
      document.removeEventListener("scroll", scheduleUpdate, true)
      window.removeEventListener("resize", scheduleUpdate)
      window.cancelAnimationFrame(frameId)
    }
  }, [])

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8">
      <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_14rem]">
        <article className="min-w-0">
          <header className="flex flex-col gap-5 border-b pb-10">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Docs</span>
              <span aria-hidden="true">/</span>
              <span>External extractors</span>
            </div>
            <h1 className="text-4xl font-normal tracking-tight text-balance md:text-5xl">
              Build an external extractor
            </h1>
            <p className="text-sm leading-6 text-muted-foreground">
              Create a Hono Cloudflare Worker that implements Lynvo protocol
              version 1.0.
            </p>
          </header>

          <div className="docs-content flex flex-col gap-16 py-12">
            <DocsContent components={docsComponents} />
          </div>

          <footer className="flex flex-col items-start gap-4 border-t py-10 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Connect the Worker</p>
              <p className="text-sm text-muted-foreground">
                Add the deployed origin and bearer key in Lynvo Settings.
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

        <aside className="hidden lg:block">
          <nav
            ref={sectionNavRef}
            aria-label="On this page"
            className="relative sticky top-24 flex flex-col gap-3 pl-5 text-sm"
          >
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-px overflow-hidden bg-border"
            >
              <span
                ref={progressBarRef}
                className="block h-full origin-top scale-y-0 bg-muted-foreground/50 transition-transform duration-150 ease-out motion-reduce:transition-none"
              />
            </span>
            <span
              ref={activeIndicatorRef}
              aria-hidden="true"
              className="absolute top-0 -left-px z-10 w-0.5 rounded-full bg-foreground transition-[transform,height] duration-200 ease-out motion-reduce:transition-none"
            />
            <p className="font-medium">On this page</p>
            {documentationSections.map((section) => (
              <a
                key={section.href}
                href={section.href}
                aria-current={
                  activeSection === section.href ? "location" : undefined
                }
                className={cn(
                  "transition-colors hover:text-foreground",
                  activeSection === section.href
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                )}
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
