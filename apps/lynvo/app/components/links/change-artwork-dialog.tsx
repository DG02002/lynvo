import {
  useCallback,
  useEffect,
  useEffectEvent,
  useReducer,
  useRef,
} from "react"
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

interface ChangeArtworkDialogState {
  readonly query: string
  readonly candidates: readonly MediaArtworkCandidate[]
  readonly isSearching: boolean
  readonly didSearch: boolean
  readonly searchFailed: boolean
  readonly selectedCandidate: MediaArtworkCandidate | undefined
}

interface QueryChangedAction {
  readonly type: "query-changed"
  readonly query: string
}

interface SearchStartedAction {
  readonly type: "search-started"
}

interface SearchSucceededAction {
  readonly type: "search-succeeded"
  readonly candidates: readonly MediaArtworkCandidate[]
}

interface SearchFailedAction {
  readonly type: "search-failed"
}

interface DialogResetAction {
  readonly type: "dialog-reset"
}

interface CandidateSelectedAction {
  readonly type: "candidate-selected"
  readonly candidate: MediaArtworkCandidate
}

interface CandidateClearedAction {
  readonly type: "candidate-cleared"
}

interface ArtworkSearchControllerRef {
  current: AbortController | undefined
}

type SearchCompletionAction = SearchSucceededAction | SearchFailedAction

interface SearchCompletionOptions {
  readonly searchAbortController: ArtworkSearchControllerRef
  readonly abortController: AbortController
  readonly dispatch: (action: SearchCompletionAction) => void
  readonly action: SearchCompletionAction
}

type ChangeArtworkDialogAction =
  | QueryChangedAction
  | SearchStartedAction
  | SearchSucceededAction
  | SearchFailedAction
  | DialogResetAction
  | CandidateSelectedAction
  | CandidateClearedAction

const initialChangeArtworkDialogState: ChangeArtworkDialogState = {
  query: "",
  candidates: [],
  isSearching: false,
  didSearch: false,
  searchFailed: false,
  selectedCandidate: undefined,
}

const changeArtworkDialogReducer = (
  state: ChangeArtworkDialogState,
  action: ChangeArtworkDialogAction
): ChangeArtworkDialogState => {
  switch (action.type) {
    case "query-changed":
      return { ...state, query: action.query }
    case "search-started":
      return {
        ...state,
        isSearching: true,
        didSearch: true,
        searchFailed: false,
      }
    case "search-succeeded":
      return {
        ...state,
        candidates: action.candidates,
        isSearching: false,
        searchFailed: false,
      }
    case "search-failed":
      return {
        ...state,
        isSearching: false,
        searchFailed: true,
      }
    case "dialog-reset":
      return initialChangeArtworkDialogState
    case "candidate-selected":
      return { ...state, selectedCandidate: action.candidate }
    case "candidate-cleared":
      return { ...state, selectedCandidate: undefined }
  }
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

const getSearchQuery = (searchQuery: string): string | undefined => {
  const trimmedQuery = searchQuery.trim()
  return trimmedQuery || undefined
}

const startArtworkSearch = (
  searchAbortController: ArtworkSearchControllerRef
): AbortController => {
  searchAbortController.current?.abort()
  const abortController = new AbortController()
  searchAbortController.current = abortController
  return abortController
}

const dispatchSearchCompletion = ({
  searchAbortController,
  abortController,
  dispatch,
  action,
}: SearchCompletionOptions): void => {
  if (
    abortController.signal.aborted ||
    searchAbortController.current !== abortController
  ) {
    return
  }
  dispatch(action)
}

const getUniqueCandidates = (
  results: ReadonlyArray<{
    readonly candidates?: ReadonlyArray<MediaArtworkCandidate>
  }>
): readonly MediaArtworkCandidate[] => {
  const seenKeys = new Set<string>()
  return results
    .flatMap((result) => result.candidates ?? [])
    .filter((candidate) => {
      const key = getCandidateKey(candidate)
      if (seenKeys.has(key)) {
        return false
      }
      seenKeys.add(key)
      return true
    })
}

const fetchArtworkCandidates = async (
  query: string,
  signal: AbortSignal
): Promise<readonly MediaArtworkCandidate[]> => {
  const response = await fetch("/api/data/media-artwork", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        { title: query, mediaKind: "movie" },
        { title: query, mediaKind: "tv" },
      ],
    }),
    signal: AbortSignal.any([
      signal,
      AbortSignal.timeout(MEDIA_ARTWORK_API_TIMEOUT_MS),
    ]),
  })
  if (!response.ok) {
    throw new Error("Media artwork search failed.")
  }
  const parsed = Schema.decodeUnknownResult(candidatesSchema)(
    await response.json()
  )
  if (Result.isFailure(parsed)) {
    throw new Error("Media artwork response was invalid.")
  }
  return getUniqueCandidates(parsed.success.results)
}

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

interface ArtworkSearchResultsProps {
  readonly candidates: readonly MediaArtworkCandidate[]
  readonly tvCandidates: readonly MediaArtworkCandidate[]
  readonly movieCandidates: readonly MediaArtworkCandidate[]
  readonly isSearching: boolean
  readonly didSearch: boolean
  readonly searchFailed: boolean
  readonly onSelectCandidate: (candidate: MediaArtworkCandidate) => void
}

const ArtworkSearchResults = ({
  candidates,
  tvCandidates,
  movieCandidates,
  isSearching,
  didSearch,
  searchFailed,
  onSelectCandidate,
}: ArtworkSearchResultsProps) => {
  if (candidates.length > 0) {
    return (
      <Tabs defaultValue="tv" className="min-h-0 flex-1 gap-5 overflow-hidden">
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
              onSelectCandidate={onSelectCandidate}
            />
          </TabsContent>
          <TabsContent value="movies">
            <CandidateGrid
              candidates={movieCandidates}
              onSelectCandidate={onSelectCandidate}
            />
          </TabsContent>
          <TabsContent value="all">
            <CandidateGrid
              candidates={candidates}
              onSelectCandidate={onSelectCandidate}
            />
          </TabsContent>
        </div>
      </Tabs>
    )
  }

  if (!isSearching && didSearch) {
    return (
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
    )
  }

  return null
}

const ChangeArtworkDialog = ({
  item,
  open,
  onOpenChange,
  onSelect,
}: ChangeArtworkDialogProps) => {
  const [state, dispatch] = useReducer(
    changeArtworkDialogReducer,
    initialChangeArtworkDialogState
  )
  const searchAbortController = useRef<AbortController | undefined>(undefined)
  const abortActiveSearch = useEffectEvent(() => {
    searchAbortController.current?.abort()
  })

  const search = useCallback(async (searchQuery: string) => {
    const query = getSearchQuery(searchQuery)
    if (!query) {
      return
    }
    const abortController = startArtworkSearch(searchAbortController)
    dispatch({ type: "search-started" })
    try {
      const candidates = await fetchArtworkCandidates(
        query,
        abortController.signal
      )
      dispatchSearchCompletion({
        searchAbortController,
        abortController,
        dispatch,
        action: { type: "search-succeeded", candidates },
      })
    } catch {
      dispatchSearchCompletion({
        searchAbortController,
        abortController,
        dispatch,
        action: {
          type: "search-failed",
        },
      })
    }
  }, [])

  useEffect(() => {
    if (!open || !item) {
      abortActiveSearch()
      return
    }
    dispatch({ type: "dialog-reset" })
    return () => abortActiveSearch()
  }, [open, item])

  const tvCandidates = getCandidatesByKind(state.candidates, "tv")
  const movieCandidates = getCandidatesByKind(state.candidates, "movie")

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
              void search(state.query)
            }}
          >
            <InputGroup className="h-12">
              <InputGroupInput
                value={state.query}
                onChange={(event) =>
                  dispatch({
                    type: "query-changed",
                    query: event.target.value,
                  })
                }
                aria-label="Search title"
                placeholder="Search by title"
                autoFocus
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="submit"
                  variant="secondary"
                  size="sm"
                  disabled={
                    state.isSearching || state.query.trim().length === 0
                  }
                >
                  {state.isSearching ? <Spinner aria-hidden="true" /> : null}
                  Search
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
          </form>
          <ArtworkSearchResults
            candidates={state.candidates}
            tvCandidates={tvCandidates}
            movieCandidates={movieCandidates}
            isSearching={state.isSearching}
            didSearch={state.didSearch}
            searchFailed={state.searchFailed}
            onSelectCandidate={(candidate) =>
              dispatch({ type: "candidate-selected", candidate })
            }
          />
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={state.selectedCandidate !== undefined}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            dispatch({ type: "candidate-cleared" })
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
          {state.selectedCandidate ? (
            <div className="flex items-center gap-4">
              <div className="w-24 shrink-0 overflow-hidden rounded-xl bg-muted ring-1 ring-foreground/10">
                <TmdbImage
                  path={state.selectedCandidate.posterPath}
                  variant="card"
                  imageType="poster"
                  alt=""
                  width={185}
                  height={278}
                />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-pretty">
                  {state.selectedCandidate.title}
                </p>
                <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                  {getCandidateCaption(state.selectedCandidate)}
                </p>
              </div>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!state.selectedCandidate) {
                  return
                }
                onSelect(state.selectedCandidate)
                dispatch({ type: "candidate-cleared" })
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
