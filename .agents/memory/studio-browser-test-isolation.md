---
name: Studio browser test isolation
description: Shared Chromium profiles can carry invalid autosaved Studio state between browser cases.
---

Browser tests for Studio must explicitly clear or replace the autosaved draft before a case that expects a fresh layout. The Studio page writes its current state to browser storage after edits, so a prior validation case can otherwise contaminate a later saved-quote or export case.

**Why:** The browser suite reuses one Chromium profile and one SPA session; a deliberately invalid discount remained active after navigation and caused an unrelated saved Studio quote test to fail.

**How to apply:** Clear `localStorage`/`sessionStorage` and navigate to a fresh Studio route, or click the visible “start new draft” action, before assertions that depend on initial Studio state.