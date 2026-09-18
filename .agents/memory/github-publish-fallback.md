---
name: GitHub publish fallback
description: Publishing this project when the configured Git HTTPS remote cannot authenticate.
---

When the configured GitHub HTTPS remote rejects Git credentials, use the installed GitHub integration API instead of handling or exposing tokens. If the repository is empty, initialize `main` with a contents commit, then create the full source tree and follow-up file commits through the API.

**Why:** The workspace remote may not receive GitHub credentials even when the Replit GitHub connection is healthy, and GitHub's Git database endpoints reject creating a tree against an empty repository.

**How to apply:** Resolve the authorized `github` connection, keep credentials inside the connector proxy, verify the resulting `main` commit through the API, and omit non-source artifacts that are not needed to build or run the application when the initial tree would otherwise include oversized uploads. If the integration directory lookup fails, `listConnections("github")` followed by `proxyFetch` can still provide the authorized Git Data API path.

If an `added` GitHub connection reports healthy but the proxy returns GitHub's explicit `Bad credentials` 401, obtain the reauthorization context and request one reconnect before retrying the failed publish operation. A fresh connection can restore Git Data API access without handling tokens manually.

**Why:** The connector status can remain healthy while the provider credential is rejected, and reauthorizing resolved that mismatch during a release publish.

**How to apply:** Retry the complete failed Git Data API publish once after reauthorization; if it still fails, stop retrying and report the blocked publication.

For the VPS handoff, attach a read-only deploy key to the exact private repository that contains the release. A successful `ssh -T` greeting identifies the repository bound to the key, so a greeting for a different repository means the VPS is offering the wrong identity even if the target repository also has a valid key.

**Why:** The direct Replit-to-VPS path can be unavailable, while a repository pull by the VPS operator remains reliable. The first production test exposed that SSH identity selection can look like a repository permission problem.

**How to apply:** Confirm the target repository and its deploy-key list through GitHub, force the intended identity when testing `git ls-remote`, then let the operator pull the verified `main` commit and validate artifact hashes before restarting only the affected containers.

The reliable release handoff is: publish source and build artifacts to `main` through the GitHub integration; use a read-only key attached to that exact repository; have the VPS operator pull with the matching SSH identity; back up the current production artifacts; update only the API/web release artifacts; restart only the two affected containers; then check health, catalog, storefront, admin, and artifact hashes.

**Why:** This separates repository publication from VPS access, avoids transferring release files through chat, and limits production restarts while preserving a rollback copy.

**How to apply:** Treat the verified GitHub commit as the release input and do not call the release complete until both file integrity and the production smoke checks pass.

The production handoff sequence has been validated successfully: deploy the exact verified commit, preserve a pre-deploy artifact backup, restart only the affected services, and require health, security-header, design-system, web-asset, and watchdog checks before declaring release complete.

**Why:** This separates source publication from production activation and provides independent evidence that both the application and its deployment packaging are healthy.

**How to apply:** Keep these checks as the minimum release gate for future Knight Basins VPS deployments.

Workspace checkpoints may create a clean local commit on `main` before the GitHub branch is updated. Treat that local checkpoint as workspace state, then publish the intended source-file tree against the current remote `main` parent rather than assuming the local commit SHA is already remote.

**Why:** The local checkpoint and GitHub data commit can have different parents or include internal workspace notes, while the release still needs a precise, source-only remote commit.

**How to apply:** Verify the remote ref after publishing and confirm the required source paths are present before reporting the push complete.

For release trees containing large generated maps or bundles, create Git blobs through the Git data API and stage base64 chunks through temporary files before assembling the blob request; do not expose credentials or rely on the local HTTPS remote.

**Why:** The connector proxy is reliable for authenticated GitHub REST operations, while direct Git auth may be unavailable and inline transfer output has a size limit.

**How to apply:** Keep the remote branch SHA as the commit parent, upload only the intended changed blobs, create one tree/commit, fast-forward the branch, then verify the tree and SHA-256 hashes remotely.

For GitHub Git Data API releases, upload blobs sequentially with a short delay instead of in parallel.

**Why:** The Replit connector proxy enforces a low per-second request limit; parallel blob creation can fail with HTTP 429 before the tree or commit exists.

**How to apply:** Retry 429 responses using the provider's delay, then create the tree and commit only after every blob upload succeeds.

The installed GitHub connection may allow repository reads and blob creation while denying tree creation, Contents writes, and `CreateCommitOnBranch`; treat that as a connector-side repository write-policy block, not a credential failure.

**Why:** A healthy OAuth connection with `repo` scope can still return 404/403 for commit-producing operations, while direct Git HTTPS authentication may also be unavailable in the workspace.

**How to apply:** Verify the branch ref remains unchanged, stop after the documented write paths fail, and report the exact repository-write block instead of repeatedly reauthorizing or exposing credentials.

When a repository-scoped GitHub token is available, Git smart HTTP accepts Basic auth with the `x-access-token` username; workflow files additionally require the token's `workflow` permission.

**Why:** The connector write endpoints were blocked, while direct Git push succeeded with a repository-scoped token; the first push was rejected only because it included a workflow file without the required scope.

**How to apply:** Use the token only through an ephemeral remote URL or credential helper, publish source files without force-push, and handle workflow files separately when the token has workflow permission.

When the GitHub connector can read the repository and create blobs but both tree creation and `createCommitOnBranch` are rejected, reauthorization may still leave commit writes forbidden.

**Why:** The connector can expose the `repo` scope while its GitHub App operation policy denies repository commit mutations; repeated retries do not repair that mismatch.

**How to apply:** Reauthorize once when the failure suggests a stale OAuth grant, retry the failed write once with the original head SHA, then stop and report the connector permission block if it remains.