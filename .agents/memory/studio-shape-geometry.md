---
name: Shared studio shape geometry
description: The non-rectangular Studio footprint decision for I, L, and U counter layouts.
---

The Studio, saved quote, and print layout must consume the same shared counter geometry instead of independently rebuilding rectangular bounds or pseudo-borders.

**Why:** L/U counters have real leg footprints and concave inner corners; separate rectangle calculations let the visual layout, 50 mm clearance validation, drag clamping, and saved quote drift apart.

**How to apply:** Treat the shape’s regions and clearance regions as the source of truth for rendering, placement safety, snapping, bounds, and labels. Preserve the existing area formulas separately from visual geometry.