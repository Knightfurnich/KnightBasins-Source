---
name: Studio inspector density
description: The Canvas-first Studio inspector pattern for workpieces with multiple sheets.
---

The Studio inspector should edit one active rectangle at a time and use a selector to switch between sheets; adding a sheet should select the new sheet immediately. The Canvas remains the primary interactive surface, not a static preview.

**Why:** A workpiece can contain several real sheets, and rendering a full editor plus compact editors for every sheet makes the inspector tall and difficult to scan, especially on mobile.

**How to apply:** Keep the full numeric, rotation, edge-status, and delete controls on the active sheet only. Preserve the existing maximum-sheet rule and keep the shared geometry model as the source of truth. Canvas interactions must remain discoverable and functional: click to select, drag to move or drop catalog items, snap connected edges, zoom, and show selection/validation markers.