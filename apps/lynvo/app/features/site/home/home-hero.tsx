import { HomeSaveDemo } from "./home-save-demo"

export const HomeHero = () => {
  return (
    <section className="relative flex min-h-[90vh] w-full flex-col items-center justify-center overflow-hidden bg-background px-0 pt-32 pb-20 lg:pt-36">
      {/* Vercel-style ambient glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-50 dark:opacity-30">
        <div className="h-[40rem] w-[40rem] rounded-full bg-primary/10 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center gap-10 px-4 sm:px-6">
        {/* Massive Typography */}
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="t-stagger-line t-stagger-line--2 mt-8 max-w-4xl text-balance text-5xl font-normal tracking-[-0.04em] md:text-7xl lg:text-[5.5rem] lg:leading-[0.95]">
            Save it here. Open it in an Android player.
          </h1>
          <p className="t-stagger-line t-stagger-line--3 mt-2 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Use the Lynvo website in any browser to save supported video links
            in a library that stays in sync, then open each URL in the selected
            player on Android TV, an Android phone, or an Android tablet.
          </p>
        </div>

        <HomeSaveDemo />
      </div>
    </section>
  )
}
