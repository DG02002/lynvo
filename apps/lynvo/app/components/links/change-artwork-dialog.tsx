import { useCallback, useEffect, useRef, useState } from "react"
import { Result, Schema } from "effect"
import { TmdbImage } from "~/features/links/components/tmdb-image"
import { Spinner } from "~/components/spinner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog"
import { Badge } from "~/components/ui/badge"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "~/components/ui/input-group"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs"
import type { LinkViewItem } from "~/features/links/types"
import { MEDIA_ARTWORK_API_TIMEOUT_MS } from "~/lib/constants"

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

const getCandidateCaption = (candidate: MediaArtworkCandidate): string =>
  candidate.year === undefined ? "Year unavailable" : String(candidate.year)

const getCandidatesByKind = (
  candidates: readonly MediaArtworkCandidate[],
  mediaKind: "movie" | "tv"
): readonly MediaArtworkCandidate[] =>
  candidates.filter((candidate) => candidate.mediaKind === mediaKind)

interface CandidateGridProps {
  readonly candidates: readonly MediaArtworkCandidate[]
  readonly onSelectCandidate: (candidate: MediaArtworkCandidate) => void
}

const CandidateGrid = ({
  candidates,
  onSelectCandidate,
}: CandidateGridProps) => (
  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
    {candidates.map((candidate) => (
      <button
        key={getCandidateKey(candidate)}
        type="button"
        aria-label={`${candidate.title}${candidate.year ? ` (${candidate.year})` : ""}`}
        className="flex min-w-0 flex-col gap-2 rounded-2xl text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onSelectCandidate(candidate)}
      >
        <span className="relative flex aspect-2/3 w-full items-center justify-center overflow-hidden rounded-2xl bg-muted ring-1 ring-foreground/10">
          {candidate.posterPath ? (
            <TmdbImage
              path={candidate.posterPath}
              variant="card"
              imageType="poster"
              sizes="(min-width: 1024px) 180px, (min-width: 640px) 25vw, 42vw"
              alt=""
              width={342}
              height={513}
            />
          ) : (
            <span className="px-4 text-center text-sm text-muted-foreground">
              No poster
            </span>
          )}
        </span>
        <span className="min-w-0 px-1 pb-1">
          <span className="line-clamp-2 text-sm font-medium leading-snug text-pretty">
            {candidate.title}
          </span>
          <span className="mt-1 block text-xs text-muted-foreground tabular-nums">
            {getCandidateCaption(candidate)}
          </span>
        </span>
      </button>
    ))}
  </div>
)

const ChangeArtworkDialog = ({
  item,
  open,
  onOpenChange,
  onSelect,
}: ChangeArtworkDialogProps) => {
  const [query, setQuery] = useState("")
  const [candidates, setCandidates] = useState<MediaArtworkCandidate[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [didSearch, setDidSearch] = useState(false)
  const [searchFailed, setSearchFailed] = useState(false)
  const [selectedCandidate, setSelectedCandidate] =
    useState<MediaArtworkCandidate>()
  const searchAbortController = useRef<AbortController | undefined>(undefined)

  const search = useCallback(async (searchQuery: string) => {
    const trimmedQuery = searchQuery.trim()
    if (!trimmedQuery) {
      return
    }
    searchAbortController.current?.abort()
    const abortController = new AbortController()
    searchAbortController.current = abortController
    setIsSearching(true)
    setDidSearch(true)
    setSearchFailed(false)
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
        signal: AbortSignal.any([
          abortController.signal,
          AbortSignal.timeout(MEDIA_ARTWORK_API_TIMEOUT_MS),
        ]),
      })
      if (!response.ok) {
        setSearchFailed(true)
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
      } else {
        setSearchFailed(true)
      }
    } catch {
      if (!abortController.signal.aborted) {
        setSearchFailed(true)
      }
    } finally {
      if (searchAbortController.current === abortController) {
        setIsSearching(false)
      }
    }
  }, [])

  useEffect(() => {
    if (!open || !item) {
      searchAbortController.current?.abort()
      return
    }
    setQuery("")
    setCandidates([])
    setDidSearch(false)
    setSearchFailed(false)
    setSelectedCandidate(undefined)
    return () => searchAbortController.current?.abort()
  }, [open, item])

  const tvCandidates = getCandidatesByKind(candidates, "tv")
  const movieCandidates = getCandidatesByKind(candidates, "movie")

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[90vh] w-full max-w-[calc(100%-2rem)] flex-col gap-5 overflow-hidden p-5 sm:max-w-4xl sm:p-7">
          <DialogHeader className="w-full min-w-0 shrink-0 pr-10">
            <DialogTitle className="text-2xl font-medium text-balance">
              Change artwork
            </DialogTitle>
            <DialogDescription>
              Search TMDB and choose the movie or TV show that matches this
              saved link.
            </DialogDescription>
          </DialogHeader>
          <form
            className="shrink-0"
            onSubmit={(event) => {
              event.preventDefault()
              void search(query)
            }}
          >
            <InputGroup className="h-12">
              <InputGroupInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search title"
                placeholder="Search by title"
                autoFocus
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="submit"
                  variant="secondary"
                  size="sm"
                  disabled={isSearching || query.trim().length === 0}
                >
                  {isSearching ? <Spinner aria-hidden="true" /> : null}
                  Search
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </form>
          {candidates.length > 0 ? (
            <Tabs
              defaultValue="tv"
              className="min-h-0 flex-1 gap-5 overflow-hidden"
            >
              <TabsList className="w-full shrink-0">
                <TabsTrigger value="tv">
                  TV shows
                  <Badge variant="secondary">{tvCandidates.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="movies">
                  Movies
                  <Badge variant="secondary">{movieCandidates.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="all">All</TabsTrigger>
              </TabsList>
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <TabsContent value="tv">
                  <CandidateGrid
                    candidates={tvCandidates}
                    onSelectCandidate={setSelectedCandidate}
                  />
                </TabsContent>
                <TabsContent value="movies">
                  <CandidateGrid
                    candidates={movieCandidates}
                    onSelectCandidate={setSelectedCandidate}
                  />
                </TabsContent>
                <TabsContent value="all">
                  <CandidateGrid
                    candidates={candidates}
                    onSelectCandidate={setSelectedCandidate}
                  />
                </TabsContent>
              </div>
            </Tabs>
          ) : !isSearching && didSearch ? (
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="flex min-h-56 flex-col items-center justify-center gap-2 px-6 text-center">
                <p className="font-medium">
                  {searchFailed ? "Search failed" : "No matches found"}
                </p>
                <p className="max-w-md text-sm text-muted-foreground text-pretty">
                  {searchFailed
                    ? "Check your connection and try again."
                    : "Try the original title, remove the year, or check the spelling."}
                </p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={selectedCandidate !== undefined}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setSelectedCandidate(undefined)
          }
        }}
      >
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Use this artwork?</AlertDialogTitle>
            <AlertDialogDescription>
              This will replace the artwork for this saved link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {selectedCandidate ? (
            <div className="flex items-center gap-4">
              <div className="w-24 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
                <TmdbImage
                  path={selectedCandidate.posterPath}
                  variant="card"
                  imageType="poster"
                  alt=""
                  width={185}
                  height={278}
                />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-pretty">
                  {selectedCandidate.title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                  {getCandidateCaption(selectedCandidate)}
                </p>
              </div>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!selectedCandidate) {
                  return
                }
                onSelect(selectedCandidate)
                setSelectedCandidate(undefined)
                onOpenChange(false)
              }}
            >
              Use artwork
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export { ChangeArtworkDialog }
