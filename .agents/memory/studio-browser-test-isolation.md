---
name: Studio browser test isolation
description: Shared Chromium profiles can carry invalid autosaved Studio state between browser cases.
---

Browser tests for Studio must explicitly clear or replace the autosaved draft before a case that expects a fresh layout. The Studio page writes its current state to browser storage after edits, so a prior validation case can otherwise contaminate a later saved-quote or export case.

**Why:** The browser suite reuses one Chromium profile and one SPA session; a deliberately invalid discount remained active after navigation and caused an unrelated saved Studio quote test to fail.

**How to apply:** Navigate to the app origin before clearing `localStorage`/`sessionStorage` because Chromium rejects storage access on `about:blank`; then navigate to a fresh Studio route, or click the visible “start new draft” action, before assertions that depend on initial Studio state.

When running one browser case with Node's `--test-name-pattern`, the matching assertion can pass while suite-level browser cleanup still reports an asynchronous `browser is not defined` failure.

**Why:** The test harness owns browser teardown outside the individual test callback, so name-filtered runs are useful for focused diagnosis but are not a clean release gate.

**How to apply:** Use the focused result to validate the targeted behavior, then rely on the full suite or a dedicated isolated process for the final browser-test status.