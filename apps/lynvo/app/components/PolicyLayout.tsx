import * as React from "react"

interface PolicyLayoutProps {
  title: string
  updatedAt: string
  children: React.ReactNode
}

export function PolicyLayout({
  title,
  updatedAt,
  children,
}: PolicyLayoutProps) {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 md:px-8">
      <article className="mx-auto flex w-full max-w-2xl flex-col gap-10 font-normal [&_strong]:font-normal">
        <header className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm">Updated: {updatedAt}</p>
          <div className="space-y-8">
            <h1 className="py-4 text-4xl font-normal tracking-tight text-balance md:py-6 md:text-6xl">
              {title}
            </h1>
          </div>
        </header>

        {children}
      </article>
    </div>
  )
}

export function PolicySection({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4">
      <h2 className="mt-10 mb-9 text-xl font-normal tracking-tight md:mt-10 md:mb-9 md:text-3xl">
        {title}
      </h2>
      <div className="leading-7 text-foreground space-y-4">{children}</div>
    </section>
  )
}
