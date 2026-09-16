---
name: Workspace declaration rebuilds
description: Why merged schema changes can leave API typechecks reading stale library declarations
---

After a shared library schema merge, rebuild the TypeScript project references before running dependent artifact typechecks. Source exports can be correct while `dist` declaration files still hide new tables or types.

**Why:** The API source imported newly merged customer tables, but the API typecheck initially resolved an older `@workspace/db` declaration output and reported missing exports.

**How to apply:** Run the workspace library build/typecheck before trusting API typecheck or release results, and keep that step in post-merge setup.