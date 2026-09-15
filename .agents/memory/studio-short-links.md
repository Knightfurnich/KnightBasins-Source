---
name: Short Studio draft links
description: LocalStorage-backed short draft URLs and live validation message behavior.
---

Short Studio links are handles into the browser's LocalStorage Draft Store, not self-contained documents. Keep the short-link store when testing a resume flow; clear only autosave state when a fresh layout is required. Legacy Base64 links remain the portable fallback and compatibility path.

**Why:** Clearing all browser storage makes a valid short URL unrecoverable by design, while a submitted validation message can outlive the state that caused it unless live edits explicitly clear stale feedback.

**How to apply:** Test short-link URLs with a preserved Draft Store, test Base64 decoding separately, and clear stale validation result text whenever the corresponding live estimate becomes valid after move/delete edits.