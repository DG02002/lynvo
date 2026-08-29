import { useEffect, useState } from "react"
import { Result, Schema } from "effect"
import { TmdbImage } from "~/features/links/components/tmdb-image"
import { Spinner } from "~/components/spinner"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { Button } from "~/components/ui/button"
import type { LinkViewItem } from "~/features/links/types"

interface ChangeArtworkDialogProps {
  readonly item: LinkViewItem | undefined
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly onSelect: (identity: MediaArtworkIdentity) => void
}

const candidatesSchema = Schema.Struct({
  results: Schema.Array(
    Schema.Struct({
      candidates: Schema.optional(
        Schema.Array(
          Schema.Struct({
            providerId: Schema.Number,
            title: Schema.String,
            year: Schema.optional(Schema.Number),
            mediaKind: Schema.optional(Schema.Literals(["movie", "tv"])),
            posterPath: Schema.optional(Schema.String),
          })
        )
      ),
    })
  ),
})

const getCandidateKey = (candidate: MediaArtworkCandidate): string =>
  `${candidate.mediaKind ?? "movie"}:${candidate.providerId}`

const getCandidateKindLabel = (candidate: MediaArtworkCandidate): string => {
  if (candidate.mediaKind === "tv") {
    return "TV"
  }
  return candidate.mediaKind === "movie" ? "Movie" : ""
}

const getCandidateCaption = (candidate: MediaArtworkCandidate): string =>
  [candidate.year, getCandidateKindLabel(candidate)]
    .filter((part) => part !== "")
    .join(" · ")

const ChangeArtworkDialog = ({
  item,
  open,
  onOpenChange,
  onSelect,
}: ChangeArtworkDialogProps) => {
  const [query, setQuery] = useState("")
  const [candidates, setCandidates] = useState<MediaArtworkCandidate[]>([])
  const [isSearching, setIsSearching] = useState(false)

  useEffect(() => {
    if (open && item) {
      setQuery(item.title || item.url)
      setCandidates([])
    }
  }, [open, item])

  const search = async () => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery || !item) {
      return
    }
    setIsSearching(true)
    try {
      const response = await fetch("/api/data/media-artwork", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [
            { title: trimmedQuery, mediaKind: "movie" },
            { title: trimmedQuery, mediaKind: "tv" },
          ],
        }),
        signal: AbortSignal.timeout(15_000),
      })
      if (!response.ok) {
        return
      }
      const parsed = Schema.decodeUnknownResult(candidatesSchema)(
        await response.json()
      )
      if (Result.isSuccess(parsed)) {
        // Movie and tv ids are separate namespaces, so the kind joins the
        // dedupe key; kindless legacy entries fall back to the id alone.
        const seenKeys = new Set<string>()
        const merged = parsed.success.results.flatMap(
          (result) => result.candidates ?? []
        )
        setCandidates(
          merged.filter((candidate) => {
            const key = getCandidateKey(candidate)
            if (seenKeys.has(key)) {
              return false
            }
            seenKeys.add(key)
            return true
          })
        )
      }
    } catch {
      // Searching is best-effort; the list stays empty on failure.
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="flex max-h-[85vh] w-full flex-col gap-4 p-6 data-[size=default]:max-w-[calc(100%-2rem)] sm:data-[size=default]:max-w-lg">
        <AlertDialogHeader className="w-full min-w-0 shrink-0">
          <AlertDialogTitle className="text-center text-xl font-normal sm:text-2xl">
            Change artwork
          </AlertDialogTitle>
        </AlertDialogHeader>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void search()
          }}
        >
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search title"
            className="min-w-0 flex-1 rounded-md border bg-transparent px-3 py-2 text-sm"
          />
          <Button type="submit" variant="outline" disabled={isSearching}>
            {isSearching ? <Spinner aria-hidden="true" /> : "Search"}
          </Button>
        </form>
        <div className="grid min-h-0 flex-1 grid-cols-3 content-start gap-3 overflow-auto sm:grid-cols-4">
          {candidates.map((candidate) => (
            <button
              key={getCandidateKey(candidate)}
              type="button"
              aria-label={`${candidate.title}${candidate.year ? ` (${candidate.year})` : ""}`}
              className="flex min-w-0 flex-col gap-1.5 rounded-lg focus-visible:outline-none"
              onClick={() => {
                onSelect(candidate)
                onOpenChange(false)
              }}
            >
              <span className="relative flex aspect-[2/3] w-full items-center justify-center overflow-hidden rounded-md border bg-muted">
                {candidate.posterPath ? (
                  <TmdbImage
                    path={candidate.posterPath}
                    variant="card"
                    imageType="poster"
                    sizes="(min-width: 640px) 108px, 30vw"
                    alt=""
                    width={185}
                    height={278}
                  />
                ) : null}
              </span>
              <span className="min-w-0 text-center">
                <span className="line-clamp-2 text-xs font-medium leading-snug">
                  {candidate.title}
                </span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {getCandidateCaption(candidate)}
                </span>
              </span>
            </button>
          ))}
          {!isSearching && candidates.length === 0 ? (
            <p className="col-span-full py-6 text-center text-sm text-muted-foreground">
              Search a title to list matches.
            </p>
          ) : null}
        </div>
        <AlertDialogCancel
          variant="outline"
          className="h-13.5 w-full border-muted-foreground/20"
        >
          Close
        </AlertDialogCancel>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export { ChangeArtworkDialog }
