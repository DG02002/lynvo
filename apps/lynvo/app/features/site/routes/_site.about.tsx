import type { Route } from "./+types/_site.about"

const externalLinkClassName =
  "underline underline-offset-4 transition-opacity hover:opacity-70"

export const meta = (_: Route.MetaArgs) => [
  { title: "About us | Lynvo" },
  {
    name: "description",
    content:
      "The story of how a Dolby Vision playback problem on Android TV led Darshan Gangani to build Lynvo.",
  },
]

const About = () => (
  <div className="w-full px-6 py-12 md:px-8 lg:px-10 xl:px-14">
    <article className="mx-auto w-full max-w-2xl font-normal">
      <header className="flex flex-col items-center gap-4 text-center">
        <p className="text-sm">Company</p>
        <h1 className="py-4 text-4xl font-normal tracking-tight text-balance md:py-6 md:text-6xl">
          About
        </h1>
      </header>

      <div className="typeset typeset-policy mt-10">
        <p>
          Lynvo started with a playback problem. I wanted to save a link on my
          Android phone or tablet and open it in a player on Android TV without
          typing the URL with a remote.
        </p>
        <section>
          <h2>Finding the right player</h2>
          <div>
            <p>
              About nine months ago, I found Dolby Vision Profile 5 videos
              available through Direct Media links. My Android TV supported
              Dolby Vision, but VLC could not play those files correctly. I
              looked for a player that supported both Dolby Vision and HTTP
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

        <section>
          <h2>The missing step</h2>
          <div>
            <p>
              Just Player could open network streams, but it had no screen for
              pasting a URL on Android TV. Its documented approach was to
              receive the URL through Android's share sheet.
            </p>
            <p>
              I could have forked the player and added a URL input. That would
              have left me maintaining a media-player fork for one small
              workflow. Instead, I{" "}
              <a
                href="https://github.com/moneytoo/Player/issues/645"
                target="_blank"
                rel="noreferrer"
                className={externalLinkClassName}
              >
                opened an issue
              </a>{" "}
              and built a small demonstration website that could invoke the
              share sheet with a selected URL.
            </p>
            <p>
              It worked, but typing long URLs with a TV remote was still
              awkward. I could copy and paste through the{" "}
              <a
                href="https://play.google.com/store/apps/details?id=com.google.android.videos"
                target="_blank"
                rel="noreferrer"
                className={externalLinkClassName}
              >
                Google TV app
              </a>
              . The workaround was easy to miss and awkward to use.
            </p>
          </div>
        </section>

        <section>
          <h2>The workaround became Lynvo</h2>
          <div>
            <p>
              I wanted to stop repeating those steps. Lynvo lets you save a link
              in a browser, find it on Android TV after sync, and send it to
              Just (Video) Player, VLC for Android, MPV, or MX Player without
              typing a long media URL with an Android TV remote.
            </p>
            <p>
              Plugins made the workflow useful beyond direct media links. Lynvo
              Plugins resolve supported Bhadoo Google Drive Index and OneDrive
              Index pages. The Plugin Server Protocol lets developers connect
              other compatible Sources.
            </p>
            <p>
              The first version worked, but it was still a rough personal tool.
              I used it almost every day, then rebuilt Lynvo around the workflow
              I actually needed.
            </p>
          </div>
        </section>

        <section>
          <h2>A link library, not a media catalogue</h2>
          <div>
            <p>
              Lynvo is sometimes compared with catalogue-driven products such as
              Stremio, but they solve different problems. Stremio organizes
              browsing around titles and add-ons. Lynvo does not provide a
              catalogue or decide what belongs in your library.
            </p>
            <p>
              A catalogue may not have the exact quality, version, or language
              you want. Lynvo starts with the link you choose, so your library
              contains your selections instead of an add-on's catalogue.
            </p>
            <p>
              Lynvo does not provide media or help users discover unauthorized
              content. People add their own supported URLs. They are responsible
              for having permission to access and play what they save.
            </p>
          </div>
        </section>

        <footer className="pt-8">
          <p className="text-base text-foreground">Darshan Gangani</p>
        </footer>
      </div>
    </article>
  </div>
)

export default About
