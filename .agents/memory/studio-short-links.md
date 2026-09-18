---
name: Short Studio draft links
description: LocalStorage-backed short draft URLs and live validation message behavior.
---

Studio has two intentional link contracts: the current “share link” embeds the full encoded state for cross-device restore, while named links copied from My Drafts use short KB handles in the browser's LocalStorage Draft Store. Legacy Base64 links remain compatible.

**Why:** A short handle cannot cross devices, while an embedded state can; a submitted validation message can also outlive the state that caused it unless live edits explicitly clear stale feedback.

**How to apply:** Test shared links after clearing browser storage, test named short links with the Draft Store preserved, and clear stale validation result text whenever the corresponding live estimate becomes valid after move/delete edits.