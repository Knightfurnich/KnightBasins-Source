---
name: Lazy media visual checks
description: Browser visual checks must account for native lazy-loading when validating image-backed cards.
---

Native lazy-loaded media may not have a natural size until its card is scrolled into view. Structural assertions can cover every off-screen card, while loaded-image assertions should first bring a representative card into view.

**Why:** A browser test that waits for every off-screen image to load can time out even when the UI and image layer are correct.

**How to apply:** For catalog or gallery regressions, assert the image-backed DOM and fallback state across all cards, then scroll representative cards before checking natural dimensions or decoded pixels.