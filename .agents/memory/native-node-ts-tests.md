---
name: Native Node TypeScript tests
description: Why direct Node execution of workspace TypeScript routes can fail before the test body runs
---

The API's production bundler resolves extensionless workspace imports, but Node's native TypeScript test runner does not reliably resolve those same source imports. Unit-test pure modules directly; use a bundled or otherwise explicit route-test harness for HTTP integration coverage.

**Why:** Directly importing the health router through the workspace API schema package failed before test execution because the source graph contains extensionless ESM imports. Changing application import conventions only for tests would add unrelated risk.

**How to apply:** Keep callback and diagnostic logic independently testable without importing the whole route graph. Add direct `/api/healthz` tests only after establishing a stable compiled-route or explicit-extension harness. For database-backed routes, test an extracted router factory with an injected database and schema-only imports; externalize `pg` and the workspace database package in the bundle, and keep the database package's internal ESM imports explicit so Node can resolve them. For deterministic crypto fixtures, import Node's mutable default crypto object; native named exports cannot be redefined by `mock.method`.