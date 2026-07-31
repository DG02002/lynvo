import type { Route } from "./+types/_site.about"

const externalLinkClassName =
  "underline underline-offset-4 transition-opacity hover:opacity-70"

export const meta = (_: Route.MetaArgs) => [
  { title: "About Us | Lynvo" },
  {
    name: "description",
    content:
      "The story of how a Dolby Vision playback problem on Android TV led Darshan Gangani to build Lynvo.",
  },
]

const About = () => (
  <div className="mx-auto w-full max-w-5xl px-4 py-12 md:px-8">
    <article className="mx-auto flex w-full max-w-2xl flex-col gap-10 font-normal">
      <header className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm">Company</p>
        <h1 className="py-4 text-4xl font-normal tracking-tight text-balance md:py-6 md:text-6xl">
          About
        </h1>
        <p className="max-w-xl text-base leading-7 text-foreground text-pretty">
          Lynvo started with a simple playback problem and grew into an easier
          way to save a link on one device and play it on another.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="mt-10 mb-9 text-xl font-normal tracking-tight md:text-3xl">
          Finding the right player
        </h2>
        <div className="space-y-4 leading-7 text-foreground">
          <p>
            About nine months ago, I found some Dolby Vision Profile 5 videos
            available through direct links. My Android TV supported Dolby Vision
            natively, but VLC could not play those files correctly. I started
            looking for a media player that supported both Dolby Vision and HTTP
            network streams.
          </p>
          <p>
            That search led me to{" "}
            <a
              href="https://github.com/moneytoo/Player"
              target="_blank"
              rel="noreferrer"
              className={externalLinkClassName}
            >
              Just (Video) Player
            </a>
            . It did exactly what I needed, and I still use it today.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="mt-10 mb-9 text-xl font-normal tracking-tight md:text-3xl">
          One important step was missing
        </h2>
        <div className="space-y-4 leading-7 text-foreground">
          <p>
            Just Player could open network streams, but it did not have a
            dedicated screen where someone could paste a URL on a TV. Its
            documented approach was to receive the URL through Android’s share
            sheet.
          </p>
          <p>
            I could have forked the player and added a URL input, but
            maintaining a media-player fork would have created a large ongoing
            cost for one small workflow. Instead, I{" "}
            <a
              href="https://github.com/moneytoo/Player/issues/645"
              target="_blank"
              rel="noreferrer"
              className={externalLinkClassName}
            >
              opened an issue
            </a>{" "}
            and built a small demonstration website that could invoke the share
            sheet with a selected URL.
          </p>
          <p>
            It worked, but typing long URLs with a TV remote was still awkward.
            I could copy and paste through the{" "}
            <a
              href="https://play.google.com/store/apps/details?id=com.google.android.videos"
              target="_blank"
              rel="noreferrer"
              className={externalLinkClassName}
            >
              Google TV app
            </a>
            , although that workaround was not obvious or convenient for
            everyone.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="mt-10 mb-9 text-xl font-normal tracking-tight md:text-3xl">
          The workaround became Lynvo
        </h2>
        <div className="space-y-4 leading-7 text-foreground">
          <p>
            I wanted a solution that anyone could use without repeating all
            those steps. Lynvo lets someone save a link from one device, find it
            on another through cloud sync, and send it to a supported player.
            There is no complicated setup and no need to type a long media URL
            with a TV remote.
          </p>
          <p>
            Extractors made the experience more useful. Lynvo’s official sources
            can resolve supported Bhadoo Google Drive Index and OneDrive Index
            pages, while the external extractor protocol lets developers connect
            other compatible sources.
          </p>
          <p>
            Before Lynvo had its current name and identity, it was called
            PlayLink. I used that earlier version myself almost every day. Lynvo
            is the same practical idea, rebuilt into a more complete and
            carefully designed product.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="mt-10 mb-9 text-xl font-normal tracking-tight md:text-3xl">
          A link library, not a media catalogue
        </h2>
        <div className="space-y-4 leading-7 text-foreground">
          <p>
            Lynvo is sometimes compared with catalogue-driven products such as
            Stremio, but they solve different problems. Stremio provides a
            familiar browsing experience built around titles and add-ons. Lynvo
            does not provide a catalogue or decide what belongs in your library.
          </p>
          <p>
            With a catalogue, the exact quality, version, or language someone
            wants may not always be available. Lynvo starts with the link the
            user chooses, so the library reflects their own selections instead
            of an add-on’s catalogue.
          </p>
          <p>
            Lynvo does not provide media or help users discover unauthorized
            content. People add their own supported URLs and are responsible for
            ensuring they have permission to access what they save and play.
          </p>
        </div>
      </section>

      <footer className="pt-8">
        <p className="text-base text-foreground">— Darshan Gangani</p>
      </footer>
    </article>
  </div>
)

export default About
