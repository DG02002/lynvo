import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"
import { CLEANUP_USER_PAGE_SIZE } from "./constants"

const crons = cronJobs()

crons.interval(
  "cleanup expired remote commands",
  { minutes: 5 },
  internal.commands.cleanupExpired,
  {}
)

crons.interval(
  "release expired managed extractions",
  { minutes: 5 },
  internal.usage.releaseExpiredManagedExtractions,
  {}
)

crons.interval(
  "cleanup expired device codes",
  { minutes: 10 },
  internal.deviceAuth.cleanupExpiredCodes
)

crons.interval(
  "cleanup expired links",
  { hours: 24 },
  internal.links.cleanupExpiredLinks,
  {
    paginationOpts: { cursor: null, numItems: CLEANUP_USER_PAGE_SIZE },
  }
)

crons.interval(
  "delete inactive users",
  { hours: 24 },
  internal.users.cleanupInactiveUsers,
  {}
)

export default crons
