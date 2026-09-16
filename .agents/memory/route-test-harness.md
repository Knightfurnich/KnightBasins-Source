---
name: Route test harness middleware
description: Native API route tests must mirror production middleware and keep CJS database drivers external.
---

Route tests that exercise authenticated JSON endpoints need both JSON parsing and cookie parsing in the harness. When bundling workspace routes for Node's native test runner, externalize the `pg` CJS driver instead of bundling it into ESM.

**Why:** Without the middleware, authenticated routes appear logged out; bundling `pg` causes dynamic `require("events")` failures.

**How to apply:** Keep harness middleware aligned with the API server entrypoint and add new external CJS dependencies to the esbuild test bundle configuration.