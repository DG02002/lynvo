import { Result, Schema } from "effect"
import {
  EMPTY_LINK_METADATA_JSON,
  TITLE_GROUP_RECONCILIATION_BATCH_SIZE,
  TITLE_GROUP_RECONCILIATION_USER_BATCH_SIZE,
} from "../constants"
import { parseCanonicalLinkMetadataJson } from "../../app/features/links/storage-schemas"
import { projectTitleGroups } from "../../app/features/links/title-grouping/title-group-projection"
import {
  getSaveDateGroupKey,
  getSaveDateGroupLabel,
} from "../../app/lib/save-date-groups"
import type {
  ExtractedLink,
  LinkExtractionStatus,
  LinkListItem,
  LinkMetadata,
} from "../../app/features/links/types"
import { extractedLinkSchema } from "../../app/features/links/storage-schemas"
import { executeOwnedWrite } from "./data-version"
import { createOpaqueId } from "./ids"
import type { LinkRow } from "./rows"
import { SAVED_LINK_COLUMNS } from "./saved-link-storage"
import {
  createMediaMetadataJobKey,
  createMediaMetadataJobStatement,
} from "../media-metadata/media-metadata-repository"

interface TitleGroupRow {
  readonly id: string
  readonly user_id: string
  readonly identity_key: string
  readonly media_kind: TitleGroupProjection["mediaKind"]
  readonly display_title: string
  readonly year: number | null
  readonly season_number: number | null
  readonly metadata_state: TitleGroupProjection["metadataState"]
  readonly provider: string | null
  readonly provider_id: string | null
  readonly poster_path: string | null
  readonly backdrop_path: string | null
  readonly overview: string | null
  readonly metadata_fetched_at: number | null
  readonly metadata_expires_at: number | null
  readonly last_added_at: number
  readonly source_count: number
  readonly created_at: number
  readonly updated_at: number
}

interface TitleEntryRow {
  readonly id: string
  readonly user_id: string
  readonly title_group_id: string
  readonly entry_key: string
  readonly kind: TitleEntryProjection["kind"]
  readonly season_number: number | null
  readonly episode_start: number | null
  readonly episode_end: number | null
  readonly display_label: string
  readonly metadata_title: string | null
  readonly metadata_state: TitleEntryProjection["metadataState"]
  readonly still_path: string | null
  readonly created_at: number
  readonly updated_at: number
}

interface TitleSourceRow {
  readonly id: string
  readonly user_id: string
  readonly title_entry_id: string
  readonly saved_link_id: string
  readonly occurrence_key: string
  readonly node_key: string
  readonly node_path: string
  readonly label: string
  readonly source_name: string
  readonly quality: string | null
  readonly size: string | null
  readonly status: SourceVariantProjection["status"] | null
  readonly media_node_kind: SourceVariantProjection["mediaNodeKind"] | null
  readonly resolution_kind: SourceVariantProjection["resolutionKind"] | null
  readonly target_url: string | null
  readonly node_json: string
  readonly timestamp: number
  readonly created_at: number
  readonly updated_at: number
}

interface ExistingTitleProjection {
  readonly groups: readonly TitleGroupRow[]
  readonly entries: readonly TitleEntryRow[]
  readonly sources: readonly TitleSourceRow[]
  readonly groupsByIdentity: ReadonlyMap<string, TitleGroupRow>
  readonly entriesByIdentity: ReadonlyMap<string, TitleEntryRow>
  readonly sourcesByIdentity: ReadonlyMap<string, TitleSourceRow>
}

interface ReconciledTitleGroup {
  readonly projection: TitleGroupProjection
  provider?: {
    readonly provider: string
    readonly providerId: string
  }
}

const parseLinkMetadataSafely = (metadataJson: string | null): LinkMetadata => {
  try {
    return parseCanonicalLinkMetadataJson(
      metadataJson ?? EMPTY_LINK_METADATA_JSON
    )
  } catch {
    return parseCanonicalLinkMetadataJson(EMPTY_LINK_METADATA_JSON)
  }
}

const toLinkListItem = (row: LinkRow): LinkListItem => {
  const extractionStatus: LinkExtractionStatus = {
    state: row.extraction_state,
  }
  if (row.extraction_error) {
    extractionStatus.error = row.extraction_error
  }
  return {
    kind: "saved",
    id: row.id,
    url: row.url,
    title: row.title ?? undefined,
    timestamp: row.created_at,
    updatedAt: row.updated_at,
    metadata: parseLinkMetadataSafely(row.meta_json),
    extractionStatus,
  }
}

const readExistingProjection = async (
  database: D1Database,
  userId: string
): Promise<ExistingTitleProjection> => {
  const [groups, entries, sources] = await Promise.all([
    database
      .prepare("SELECT * FROM title_groups WHERE user_id = ?1")
      .bind(userId)
      .all<TitleGroupRow>(),
    database
      .prepare("SELECT * FROM title_entries WHERE user_id = ?1")
      .bind(userId)
      .all<TitleEntryRow>(),
    database
      .prepare("SELECT * FROM title_sources WHERE user_id = ?1")
      .bind(userId)
      .all<TitleSourceRow>(),
  ])
  return {
    groups: groups.results,
    entries: entries.results,
    sources: sources.results,
    groupsByIdentity: new Map(
      groups.results.map((group) => [group.identity_key, group])
    ),
    entriesByIdentity: new Map(
      entries.results.map((entry) => [
        `${entry.title_group_id}:${entry.entry_key}`,
        entry,
      ])
    ),
    sourcesByIdentity: new Map(
      sources.results.map((source) => [
        `${source.title_entry_id}:${source.saved_link_id}:${source.node_key}`,
        source,
      ])
    ),
  }
}

const getExistingGroup = (
  existing: ExistingTitleProjection,
  group: TitleGroupProjection
): TitleGroupRow | undefined => existing.groupsByIdentity.get(group.identityKey)

const getExistingEntry = (
  existing: ExistingTitleProjection,
  groupId: string,
  entry: TitleEntryProjection
): TitleEntryRow | undefined =>
  existing.entriesByIdentity.get(`${groupId}:${entry.entryKey}`)

const getExistingSource = (
  existing: ExistingTitleProjection,
  entryId: string,
  source: SourceVariantProjection
): TitleSourceRow | undefined =>
  existing.sourcesByIdentity.get(
    `${entryId}:${source.savedLinkId}:${source.nodeKey}`
  )

const toReconciledGroup = (
  existing: ExistingTitleProjection,
  group: TitleGroupProjection
): ReconciledTitleGroup => {
  const existingGroup = getExistingGroup(existing, group)
  const groupId = existingGroup?.id ?? createOpaqueId()
  const groupMetadataState =
    existingGroup?.metadata_state ?? group.metadataState
  const entries = group.entries.map((entry) => {
    const existingEntry = getExistingEntry(existing, groupId, entry)
    const entryId = existingEntry?.id ?? createOpaqueId()
    const sources = entry.sources.map((source) => {
      const existingSource = getExistingSource(existing, entryId, source)
      return {
        ...source,
        id: existingSource?.id ?? createOpaqueId(),
      }
    })
    return {
      ...entry,
      id: entryId,
      metadataState: existingEntry?.metadata_state ?? groupMetadataState,
      metadataTitle: existingEntry?.metadata_title ?? entry.metadataTitle,
      stillPath: existingEntry?.still_path ?? entry.stillPath,
      sources,
    }
  })
  const projection: TitleGroupProjection = {
    ...group,
    id: groupId,
    metadataState: groupMetadataState,
    provider: existingGroup?.provider ?? undefined,
    posterPath: existingGroup?.poster_path ?? group.posterPath,
    backdropPath: existingGroup?.backdrop_path ?? group.backdropPath,
    overview: existingGroup?.overview ?? group.overview,
    metadataFetchedAt:
      existingGroup?.metadata_fetched_at ?? group.metadataFetchedAt,
    metadataExpiresAt:
      existingGroup?.metadata_expires_at ?? group.metadataExpiresAt,
    entries,
  }
  const reconciledGroup: ReconciledTitleGroup = { projection }
  const providerId = existingGroup?.provider_id
  if (existingGroup?.provider && providerId) {
    reconciledGroup.provider = {
      provider: existingGroup.provider,
      providerId,
    }
  }
  return reconciledGroup
}

const createTitleGroupInsert = (
  database: D1Database,
  userId: string,
  group: TitleGroupProjection,
  provider: ReconciledTitleGroup["provider"],
  now: number,
  guard?: TitleGroupReconciliationGuard
): D1PreparedStatement =>
  database
    .prepare(
      `INSERT INTO title_groups (id, user_id, identity_key, media_kind, display_title, year, season_number, metadata_state, provider, provider_id, poster_path, backdrop_path, overview, metadata_fetched_at, metadata_expires_at, last_added_at, source_count, created_at, updated_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19
       WHERE ?20 IS NULL OR EXISTS (
         SELECT 1 FROM links WHERE id = ?20 AND user_id = ?2 AND extraction_state = ?21 AND extraction_attempts = ?22
         AND ((?23 IS NULL AND extraction_lease_expires_at IS NULL) OR extraction_lease_expires_at = ?23)
       )
       ON CONFLICT(id) DO UPDATE SET
         identity_key = excluded.identity_key,
         media_kind = excluded.media_kind,
         display_title = excluded.display_title,
         year = COALESCE(title_groups.year, excluded.year),
         season_number = excluded.season_number,
         last_added_at = excluded.last_added_at,
         source_count = excluded.source_count,
         updated_at = excluded.updated_at`
    )
    .bind(
      group.id,
      userId,
      group.identityKey,
      group.mediaKind,
      group.displayTitle,
      group.year ?? null,
      group.seasonNumber ?? null,
      group.metadataState,
      provider?.provider ?? null,
      provider?.providerId ?? null,
      group.posterPath ?? null,
      group.backdropPath ?? null,
      group.overview ?? null,
      group.metadataFetchedAt ?? null,
      group.metadataExpiresAt ?? null,
      group.lastAddedAt,
      group.sourceCount,
      now,
      now,
      guard?.linkId ?? null,
      guard?.extractionState ?? null,
      guard?.extractionAttempts ?? null,
      guard?.leaseExpiresAt ?? null
    )

const createTitleEntryInsert = (
  database: D1Database,
  userId: string,
  groupId: string,
  entry: TitleEntryProjection,
  now: number,
  guard?: TitleGroupReconciliationGuard
): D1PreparedStatement =>
  database
    .prepare(
      `INSERT INTO title_entries (id, user_id, title_group_id, entry_key, kind, season_number, episode_start, episode_end, display_label, metadata_title, metadata_state, still_path, created_at, updated_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14
       WHERE ?15 IS NULL OR EXISTS (
         SELECT 1 FROM links WHERE id = ?15 AND user_id = ?2 AND extraction_state = ?16 AND extraction_attempts = ?17
         AND ((?18 IS NULL AND extraction_lease_expires_at IS NULL) OR extraction_lease_expires_at = ?18)
       )
       ON CONFLICT(id) DO UPDATE SET
         entry_key = excluded.entry_key,
         kind = excluded.kind,
         season_number = excluded.season_number,
         episode_start = excluded.episode_start,
         episode_end = excluded.episode_end,
         display_label = excluded.display_label,
         updated_at = excluded.updated_at`
    )
    .bind(
      entry.id,
      userId,
      groupId,
      entry.entryKey,
      entry.kind,
      entry.seasonNumber ?? null,
      entry.episodeStart ?? null,
      entry.episodeEnd ?? null,
      entry.displayLabel,
      entry.metadataTitle ?? null,
      entry.metadataState,
      entry.stillPath ?? null,
      now,
      now,
      guard?.linkId ?? null,
      guard?.extractionState ?? null,
      guard?.extractionAttempts ?? null,
      guard?.leaseExpiresAt ?? null
    )

const createTitleSourceInsert = (
  database: D1Database,
  userId: string,
  entryId: string,
  source: SourceVariantProjection,
  now: number,
  guard?: TitleGroupReconciliationGuard
): D1PreparedStatement =>
  database
    .prepare(
      `INSERT INTO title_sources (id, user_id, title_entry_id, saved_link_id, occurrence_key, node_key, node_path, label, source_name, quality, size, status, media_node_kind, resolution_kind, target_url, node_json, timestamp, created_at, updated_at)
       SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19
       WHERE ?20 IS NULL OR EXISTS (
         SELECT 1 FROM links WHERE id = ?20 AND user_id = ?2 AND extraction_state = ?21 AND extraction_attempts = ?22
         AND ((?23 IS NULL AND extraction_lease_expires_at IS NULL) OR extraction_lease_expires_at = ?23)
       )
       ON CONFLICT(id) DO UPDATE SET
         saved_link_id = excluded.saved_link_id,
         occurrence_key = excluded.occurrence_key,
         node_key = excluded.node_key,
         node_path = excluded.node_path,
         label = excluded.label,
         source_name = excluded.source_name,
         quality = excluded.quality,
         size = excluded.size,
         status = excluded.status,
         media_node_kind = excluded.media_node_kind,
         resolution_kind = excluded.resolution_kind,
         target_url = excluded.target_url,
         node_json = excluded.node_json,
         timestamp = excluded.timestamp,
         updated_at = excluded.updated_at`
    )
    .bind(
      source.id,
      userId,
      entryId,
      source.savedLinkId,
      source.occurrenceKey,
      source.nodeKey,
      source.nodePath,
      source.label,
      source.sourceName,
      source.quality ?? null,
      source.size ?? null,
      source.status ?? null,
      source.mediaNodeKind ?? null,
      source.resolutionKind ?? null,
      source.target ?? null,
      JSON.stringify(source.node),
      source.timestamp,
      now,
      now,
      guard?.linkId ?? null,
      guard?.extractionState ?? null,
      guard?.extractionAttempts ?? null,
      guard?.leaseExpiresAt ?? null
    )

export const getTitleGroupReconciliationStatements = async (
  database: D1Database,
  userId: string,
  rows: readonly LinkRow[],
  now: number,
  guard?: TitleGroupReconciliationGuard
): Promise<readonly D1PreparedStatement[]> => {
  if (rows.length > TITLE_GROUP_RECONCILIATION_BATCH_SIZE) {
    throw new Error("Saved link projection exceeds the reconciliation limit")
  }
  const existing = await readExistingProjection(database, userId)
  const projection = projectTitleGroups(rows.map(toLinkListItem), now)
  const reconciledGroups = projection.dateGroups
    .flatMap((dateGroup) => [...dateGroup.groups])
    .concat([...projection.unmatchedGroups])
    .map((group) => toReconciledGroup(existing, group))

  const statements: D1PreparedStatement[] = []
  const desiredGroupIds = new Set<string>()
  const desiredEntryIds = new Set<string>()
  const desiredSourceIds = new Set<string>()
  for (const reconciledGroup of reconciledGroups) {
    const projectionGroupId = reconciledGroup.projection.id ?? ""
    desiredGroupIds.add(projectionGroupId)
    statements.push(
      createTitleGroupInsert(
        database,
        userId,
        reconciledGroup.projection,
        reconciledGroup.provider,
        now,
        guard
      )
    )
    if (
      reconciledGroup.projection.metadataState === "pending" &&
      reconciledGroup.projection.mediaKind !== "unmatched"
    ) {
      const mediaKind =
        reconciledGroup.projection.mediaKind === "movie" ? "movie" : "tv"
      statements.push(
        createMediaMetadataJobStatement(database, {
          jobKey: createMediaMetadataJobKey({
            provider: "tmdb",
            mediaKind,
            title: reconciledGroup.projection.displayTitle,
            year: reconciledGroup.projection.year,
            seasonNumber: reconciledGroup.projection.seasonNumber,
          }),
          requestedUserId: userId,
          titleGroupId: projectionGroupId,
          provider: "tmdb",
          mediaKind,
          title: reconciledGroup.projection.displayTitle,
          year: reconciledGroup.projection.year,
          seasonNumber: reconciledGroup.projection.seasonNumber,
          now,
        })
      )
    }
    for (const entry of reconciledGroup.projection.entries) {
      desiredEntryIds.add(entry.id ?? "")
      statements.push(
        createTitleEntryInsert(
          database,
          userId,
          projectionGroupId,
          entry,
          now,
          guard
        )
      )
      for (const source of entry.sources) {
        desiredSourceIds.add(source.id ?? "")
        statements.push(
          createTitleSourceInsert(
            database,
            userId,
            entry.id ?? "",
            source,
            now,
            guard
          )
        )
      }
    }
  }
  const createGuardedDelete = (table: string, id: string) =>
    database
      .prepare(
        `DELETE FROM ${table} WHERE id = ?1 AND user_id = ?2 AND (?3 IS NULL OR EXISTS (
          SELECT 1 FROM links WHERE id = ?3 AND user_id = ?2 AND extraction_state = ?4 AND extraction_attempts = ?5
          AND ((?6 IS NULL AND extraction_lease_expires_at IS NULL) OR extraction_lease_expires_at = ?6)
        ))`
      )
      .bind(
        id,
        userId,
        guard?.linkId ?? null,
        guard?.extractionState ?? null,
        guard?.extractionAttempts ?? null,
        guard?.leaseExpiresAt ?? null
      )
  for (const source of existing.sources) {
    if (!desiredSourceIds.has(source.id)) {
      statements.push(createGuardedDelete("title_sources", source.id))
    }
  }
  for (const entry of existing.entries) {
    if (!desiredEntryIds.has(entry.id)) {
      statements.push(createGuardedDelete("title_entries", entry.id))
    }
  }
  for (const group of existing.groups) {
    if (!desiredGroupIds.has(group.id)) {
      statements.push(createGuardedDelete("title_groups", group.id))
    }
  }
  return statements
}

export const reconcileTitleGroups = async (
  database: D1Database,
  userId: string,
  rows: readonly LinkRow[],
  now: number
): Promise<number> => {
  const statements = await getTitleGroupReconciliationStatements(
    database,
    userId,
    rows,
    now
  )
  return (await executeOwnedWrite(database, userId, statements)).dataVersion
}

export interface MissingTitleGroupsReconciliation {
  readonly userId: string
  readonly dataVersion: number
}

export const reconcileMissingTitleGroups = async (
  database: D1Database,
  now: number
): Promise<readonly MissingTitleGroupsReconciliation[]> => {
  const users = await database
    .prepare(
      `SELECT DISTINCT links.user_id AS user_id
       FROM links
       WHERE NOT EXISTS (
         SELECT 1 FROM title_groups
         WHERE title_groups.user_id = links.user_id
       )
       LIMIT ?1`
    )
    .bind(TITLE_GROUP_RECONCILIATION_USER_BATCH_SIZE)
    .all<{ user_id: string }>()
  const reconciledUsers: MissingTitleGroupsReconciliation[] = []
  for (const user of users.results) {
    const rows = await listAllLinkRowsForProjection(database, user.user_id)
    if (rows.length === 0) {
      continue
    }
    const statements = await getTitleGroupReconciliationStatements(
      database,
      user.user_id,
      rows,
      now
    )
    const result = await executeOwnedWrite(database, user.user_id, statements)
    reconciledUsers.push({
      userId: user.user_id,
      dataVersion: result.dataVersion,
    })
  }
  return reconciledUsers
}

export const listAllLinkRowsForProjection = async (
  database: D1Database,
  userId: string
): Promise<LinkRow[]> => {
  const result = await database
    .prepare(
      `SELECT ${SAVED_LINK_COLUMNS} FROM links WHERE user_id = ?1 ORDER BY created_at DESC`
    )
    .bind(userId)
    .all<LinkRow>()
  return result.results
}

const decodeSourceNode = (source: TitleSourceRow): ExtractedLink => {
  try {
    const parsed = Schema.decodeUnknownResult(extractedLinkSchema)(
      JSON.parse(source.node_json)
    )
    if (Result.isSuccess(parsed)) {
      return parsed.success
    }
  } catch {
    return {
      nodeKey: source.node_key,
      url: source.target_url ?? undefined,
      label: source.label,
      type: source.media_node_kind === "group" ? "folder" : "file",
      mediaNodeKind: source.media_node_kind ?? undefined,
      resolutionKind: source.resolution_kind ?? undefined,
    }
  }
  return {
    nodeKey: source.node_key,
    url: source.target_url ?? undefined,
    label: source.label,
    type: source.media_node_kind === "group" ? "folder" : "file",
    mediaNodeKind: source.media_node_kind ?? undefined,
    resolutionKind: source.resolution_kind ?? undefined,
  }
}

const mapStoredSource = (source: TitleSourceRow): SourceVariantProjection => ({
  id: source.id,
  savedLinkId: source.saved_link_id,
  occurrenceKey: source.occurrence_key,
  nodeKey: source.node_key,
  nodePath: source.node_path,
  label: source.label,
  sourceName: source.source_name,
  quality: source.quality ?? undefined,
  size: source.size ?? undefined,
  status: source.status ?? undefined,
  mediaNodeKind: source.media_node_kind ?? undefined,
  resolutionKind: source.resolution_kind ?? undefined,
  target: source.target_url ?? undefined,
  node: decodeSourceNode(source),
  timestamp: source.timestamp,
})

const mapStoredGroup = (
  group: TitleGroupRow,
  entries: readonly TitleEntryRow[],
  sources: readonly TitleSourceRow[]
): TitleGroupProjection => {
  const projectedEntries: TitleEntryProjection[] = []
  for (const entry of entries) {
    if (entry.title_group_id !== group.id) {
      continue
    }
    const projectedSources: SourceVariantProjection[] = []
    for (const source of sources) {
      if (source.title_entry_id === entry.id) {
        projectedSources.push(mapStoredSource(source))
      }
    }
    projectedEntries.push({
      id: entry.id,
      entryKey: entry.entry_key,
      kind: entry.kind,
      seasonNumber: entry.season_number ?? undefined,
      episodeStart: entry.episode_start ?? undefined,
      episodeEnd: entry.episode_end ?? undefined,
      displayLabel: entry.display_label,
      metadataTitle: entry.metadata_title ?? undefined,
      metadataState: entry.metadata_state,
      stillPath: entry.still_path ?? undefined,
      sources: projectedSources,
    })
  }
  return {
    id: group.id,
    identityKey: group.identity_key,
    mediaKind: group.media_kind,
    displayTitle: group.display_title,
    year: group.year ?? undefined,
    seasonNumber: group.season_number ?? undefined,
    metadataState: group.metadata_state,
    provider: group.provider ?? undefined,
    posterPath: group.poster_path ?? undefined,
    backdropPath: group.backdrop_path ?? undefined,
    overview: group.overview ?? undefined,
    metadataFetchedAt: group.metadata_fetched_at ?? undefined,
    metadataExpiresAt: group.metadata_expires_at ?? undefined,
    lastAddedAt: group.last_added_at,
    sourceCount: group.source_count,
    entries: projectedEntries,
  }
}

const groupToDateProjection = (
  groups: readonly TitleGroupProjection[],
  now: number
): TitleProjection => {
  const dateGroups = new Map<string, TitleDateGroupProjection>()
  for (const group of groups.filter((item) => item.mediaKind !== "unmatched")) {
    const key = getSaveDateGroupKey(group.lastAddedAt, now)
    const label = getSaveDateGroupLabel(group.lastAddedAt, now)
    const current = dateGroups.get(key)
    dateGroups.set(key, {
      key,
      label,
      groups: [...(current?.groups ?? []), group],
    })
  }
  return {
    dateGroups: [...dateGroups.values()],
    unmatchedGroups: groups.filter((group) => group.mediaKind === "unmatched"),
  }
}

export const listTitleGroups = async (
  database: D1Database,
  userId: string,
  now: number
): Promise<TitleProjection> => {
  const existing = await readExistingProjection(database, userId)
  const groups = existing.groups
    .map((group) => mapStoredGroup(group, existing.entries, existing.sources))
    .sort((firstGroup, secondGroup) => {
      if (secondGroup.lastAddedAt !== firstGroup.lastAddedAt) {
        return secondGroup.lastAddedAt - firstGroup.lastAddedAt
      }
      return firstGroup.displayTitle.localeCompare(secondGroup.displayTitle)
    })
  return groupToDateProjection(groups, now)
}

export const getTitleGroupById = async (
  database: D1Database,
  userId: string,
  titleGroupId: string
): Promise<TitleGroupProjection | null> => {
  const existing = await readExistingProjection(database, userId)
  const group = existing.groups.find((row) => row.id === titleGroupId)
  return group
    ? mapStoredGroup(group, existing.entries, existing.sources)
    : null
}
