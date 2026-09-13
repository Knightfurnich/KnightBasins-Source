---
name: GitHub publish fallback
description: Publishing this project when the configured Git HTTPS remote cannot authenticate.
---

When the configured GitHub HTTPS remote rejects Git credentials, use the installed GitHub integration API instead of handling or exposing tokens. If the repository is empty, initialize `main` with a contents commit, then create the full source tree and follow-up file commits through the API.

**Why:** The workspace remote may not receive GitHub credentials even when the Replit GitHub connection is healthy, and GitHub's Git database endpoints reject creating a tree against an empty repository.

**How to apply:** Resolve the authorized `github` connection, keep credentials inside the connector proxy, verify the resulting `main` commit through the API, and omit non-source artifacts that are not needed to build or run the application when the initial tree would otherwise include oversized uploads.