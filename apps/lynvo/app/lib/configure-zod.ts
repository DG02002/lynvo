import { z } from "zod"

// Lynvo's production CSP intentionally disallows string evaluation. Configure
// Zod before route modules initialize so it skips its `new Function` JIT probe.
z.config({ jitless: true })
