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
            posterPath: Schema.optional(Schema.String),
          })
        )
      ),
    })
  ),
})

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
        const seenIds = new Set<number>()
        const merged = parsed.success.results.flatMap(
          (result) => result.candidates ?? []
        )
        setCandidates(
          merged.filter((candidate) => {
            if (seenIds.has(candidate.providerId)) {
              return false
            }
            seenIds.add(candidate.providerId)
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
      <AlertDialogContent className="flex max-h-[85vh] w-full flex-col gap-4 p-6 data-[size=default]:max-w-[calc(100%-2rem)] sm:data-[size=default]:max-w-md">
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
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto">
          {candidates.map((candidate) => (
            <button
              key={candidate.providerId}
              type="button"
              className="flex items-center gap-3 rounded-lg border p-2 text-left hover:bg-muted/50"
              onClick={() => {
                onSelect(candidate)
                onOpenChange(false)
              }}
            >
              <span className="flex h-16 w-11 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                {candidate.posterPath ? (
                  <TmdbImage
                    path={candidate.posterPath}
                    variant="card"
                    imageType="poster"
                    sizes="44px"
                    alt=""
                    width={92}
                    height={138}
                  />
                ) : null}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">
                  {candidate.title}
                </span>
                {candidate.year !== undefined && (
                  <span className="block text-xs text-muted-foreground">
                    {candidate.year}
                  </span>
                )}
              </span>
            </button>
          ))}
          {!isSearching && candidates.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
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
