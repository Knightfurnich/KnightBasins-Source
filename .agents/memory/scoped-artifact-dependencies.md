---
name: Scoped artifact dependencies
description: Dependency installation behavior in the pnpm workspace when a package belongs to one artifact.
---

When adding a package for one artifact, target that workspace package explicitly; the default package installer can interpret the workspace root as the target and refuse the change.

**Why:** Artifact-specific source dependencies should stay isolated from unrelated applications, and the workspace root is not the storefront’s dependency boundary.

**How to apply:** Confirm the package name in the artifact package manifest, install or update it using the package-scoped workspace path, then run the artifact’s typecheck and build.