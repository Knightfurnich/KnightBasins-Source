---
name: Studio export pipeline
description: Shared DXF/PDF export behavior and the Thai-text rendering constraint for Studio layouts.
---

Studio exports must consume the shared export model derived from the existing Studio geometry, with DXF coordinates remaining in real millimetres and unknown basin cut-outs represented only as labelled placeholders.

**Why:** Rebuilding I/L/U geometry separately causes saved layouts, safety checks, DXF, and PDF to drift; catalog entries without hole dimensions must never become guessed production geometry.

**How to apply:** Keep DXF as an ASCII-compatible CAD artifact with the required layer names and English-only labels. For customer-facing PDF, use the browser's print pipeline with a print-only layout and Thai print CSS; set a meaningful document title before printing and restore it after `afterprint`.