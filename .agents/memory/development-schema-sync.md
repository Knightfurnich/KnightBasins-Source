---
name: Development schema sync
description: New Drizzle tables and columns must be pushed to the development database before restarting artifact workflows.
---

When a task adds database schema, apply the development schema before restarting services or relying on live endpoint checks.

**Why:** Artifact workflows connect to the existing development database at startup; code can typecheck and build while the API still fails immediately on a missing table or column.

**How to apply:** Run the workspace database push command after schema edits, then restart the API workflow and verify its health endpoint before frontend checks.