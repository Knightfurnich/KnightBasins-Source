---
name: GitHub publish fallback
description: Publishing this project when the configured Git HTTPS remote cannot authenticate.
---

When the configured GitHub HTTPS remote rejects Git credentials, use the installed GitHub integration API instead of handling or exposing tokens. If the repository is empty, initialize `main` with a contents commit, then create the full source tree and follow-up file commits through the API.

**Why:** The workspace remote may not receive GitHub credentials even when the Replit GitHub connection is healthy, and GitHub's Git database endpoints reject creating a tree against an empty repository.

**How to apply:** Resolve the authorized `github` connection, keep credentials inside the connector proxy, verify the resulting `main` commit through the API, and omit non-source artifacts that are not needed to build or run the application when the initial tree would otherwise include oversized uploads. If the integration directory lookup fails, `listConnections("github")` followed by `proxyFetch` can still provide the authorized Git Data API path.

For the VPS handoff, attach a read-only deploy key to the exact private repository that contains the release. A successful `ssh -T` greeting identifies the repository bound to the key, so a greeting for a different repository means the VPS is offering the wrong identity even if the target repository also has a valid key.

**Why:** The direct Replit-to-VPS path can be unavailable, while a repository pull by the VPS operator remains reliable. The first production test exposed that SSH identity selection can look like a repository permission problem.

**How to apply:** Confirm the target repository and its deploy-key list through GitHub, force the intended identity when testing `git ls-remote`, then let the operator pull the verified `main` commit and validate artifact hashes before restarting only the affected containers.

The reliable release handoff is: publish source and build artifacts to `main` through the GitHub integration; use a read-only key attached to that exact repository; have the VPS operator pull with the matching SSH identity; back up the current production artifacts; update only the API/web release artifacts; restart only the two affected containers; then check health, catalog, storefront, admin, and artifact hashes.

**Why:** This separates repository publication from VPS access, avoids transferring release files through chat, and limits production restarts while preserving a rollback copy.

**How to apply:** Treat the verified GitHub commit as the release input and do not call the release complete until both file integrity and the production smoke checks pass.

For release trees containing large generated maps or bundles, create Git blobs through the Git data API and stage base64 chunks through temporary files before assembling the blob request; do not expose credentials or rely on the local HTTPS remote.

**Why:** The connector proxy is reliable for authenticated GitHub REST operations, while direct Git auth may be unavailable and inline transfer output has a size limit.

**How to apply:** Keep the remote branch SHA as the commit parent, upload only the intended changed blobs, create one tree/commit, fast-forward the branch, then verify the tree and SHA-256 hashes remotely.

For GitHub Git Data API releases, upload blobs sequentially with a short delay instead of in parallel.

**Why:** The Replit connector proxy enforces a low per-second request limit; parallel blob creation can fail with HTTP 429 before the tree or commit exists.

**How to apply:** Retry 429 responses using the provider's delay, then create the tree and commit only after every blob upload succeeds.