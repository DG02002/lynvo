import { cronJobs } from "convex/server"
import { internal } from "./_generated/api"

const crons = cronJobs()

// Run cleanupOldCommands every 5 minutes to delete unread commands
crons.interval(
  "cleanup old commands",
  { minutes: 5 },
  internal.commands.cleanupOldCommands
)

crons.interval(
  "cleanup expired device codes",
  { minutes: 10 },
  internal.tv.cleanupExpiredCodes
)

crons.interval(
  "cleanup expired recent cards",
  { hours: 24 },
  internal.links.cleanupExpiredRecentCards
)

crons.interval(
  "delete inactive users",
  { hours: 24 },
  internal.users.cleanupInactiveUsers
)

export default crons
