import { HomeSaveDemo } from "./home-save-demo"

export const HomeHero = () => {
  return (
    <section className="relative flex min-h-[90vh] w-full flex-col items-center justify-center overflow-hidden bg-background px-0 pt-32 pb-20 lg:pt-36">
      <div className="relative z-10 flex w-full flex-col items-center gap-10 px-6 md:px-8 lg:px-10 xl:px-14">
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
