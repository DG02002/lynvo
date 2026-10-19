import { vi } from "vitest"

import type { LinkItemActions } from "~/features/links/link-item-actions"

export const createLinkItemActions = (
  overrides: Partial<LinkItemActions> = {}
): LinkItemActions => ({
  play: vi.fn().mockResolvedValue({ accepted: true }),
  remove: vi.fn(),
  showLinks: vi.fn(),
  markOpened: vi.fn(),
  expandFolder: vi.fn(),
  softRefresh: vi.fn(),
  hardRefresh: vi.fn(),
  expandMirror: vi.fn().mockResolvedValue(null),
  ...overrides,
})
