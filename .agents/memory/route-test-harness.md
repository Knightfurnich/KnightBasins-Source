---
name: Route test harness middleware
description: Native API route tests must mirror production middleware and keep CJS database drivers external.
---

Route tests that exercise authenticated JSON endpoints need both JSON parsing and cookie parsing in the harness. When bundling workspace routes for Node's native test runner, externalize CJS dependencies such as `pg` and avoid bundling the Pino logger's dynamic Node-module loading.

**Why:** Without the middleware, authenticated routes appear logged out; bundling CJS drivers or Pino causes unsupported dynamic `require` failures.

**How to apply:** Keep harness middleware aligned with the API server entrypoint, externalize new CJS dependencies in the esbuild test bundle, and keep route-specific logging out of the bundled module graph.