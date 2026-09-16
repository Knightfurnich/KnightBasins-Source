---
name: Post-merge setup reliability
description: Requirements for the automatic setup script that runs after task merges
---

The post-merge setup must be explicitly non-interactive and use exact workspace package filters. Its timeout needs enough buffer for dependency installation and database schema reconciliation, even when typical runs are fast.

**Why:** A merge reconciliation reported an unexpected disconnect even though the setup could complete quickly on retry. A strict shell, CI mode, offline preference, exact DB package filter, and a larger timeout make transient or unattended merge runs safer.

**How to apply:** Keep `scripts/post-merge.sh` idempotent and fail-fast, run package installation with the frozen lockfile, invoke the database package by its workspace name, and keep the configured timeout around two minutes unless measured needs change.