---
name: Async quote route tests
description: Browser checks for quote creation must wait for the loaded saved-quote root after navigation, not only a shared formal-quote selector.
---

When a quote action navigates from an editor to an asynchronously loaded public quote, browser tests should scope selectors to a saved-quote root that only renders after the API response is ready.

**Why:** The editor and saved page intentionally share the formal quote component, so a selector for that component alone can match stale DOM during the route transition and produce flaky assertions.

**How to apply:** Add a page-specific loaded marker and wait for it before checking rows, print styles, or saved-quote actions. When testing a non-blocking layout warning, keep the rest of the geometry valid (for example, use a second valid rectangle for basin placement) so unrelated validation does not mask the behavior under test.