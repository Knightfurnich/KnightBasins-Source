---
name: Active catalog SKU sorting
description: Durable rule for keeping storefront model ordering compatible with future catalog records.
---

The storefront's SKU sort must operate on the current active catalog collection and use natural numeric ordering; it must not encode the currently known SKU range in its label or logic.

**Why:** Catalog records are published dynamically, so a new model such as KF031 or a different valid prefix must appear, count, filter, and sort without a storefront code change.

**How to apply:** Pass the active catalog list into the storefront view, keep SKU sorting as a reusable pure helper, and describe the control as ascending model/SKU order rather than a fixed range.